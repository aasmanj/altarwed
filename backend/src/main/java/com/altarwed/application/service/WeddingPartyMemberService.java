package com.altarwed.application.service;

import com.altarwed.application.dto.CreateWeddingPartyMemberRequest;
import com.altarwed.application.dto.UpdateWeddingPartyMemberRequest;
import com.altarwed.domain.exception.WeddingPartyMemberNotFoundException;
import com.altarwed.domain.model.WeddingPartyMember;
import com.altarwed.domain.port.WeddingPartyMemberRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class WeddingPartyMemberService {

    private static final Logger log = LoggerFactory.getLogger(WeddingPartyMemberService.class);

    // Non-PII structured field tag for the shared blob-cleanup logs (App Insights indexes it).
    private static final String BLOB_FIELD = "party-member";

    private final WeddingPartyMemberRepository repository;
    private final MediaUploadService mediaUploadService;

    public WeddingPartyMemberService(WeddingPartyMemberRepository repository,
                                     MediaUploadService mediaUploadService) {
        this.repository = repository;
        this.mediaUploadService = mediaUploadService;
    }

    @Transactional(readOnly = true)
    public List<WeddingPartyMember> listMembers(UUID weddingWebsiteId) {
        return repository.findAllByWeddingWebsiteId(weddingWebsiteId);
    }

    @Transactional
    public WeddingPartyMember addMember(UUID weddingWebsiteId, CreateWeddingPartyMemberRequest req) {
        // Server-authoritative append position: max(sortOrder)+1, not the client's value and not
        // the list count. After a delete the count no longer equals the next free slot, so a
        // count-based (or stale/hostile client) sortOrder would collide with an existing row.
        int nextSort = repository.findAllByWeddingWebsiteId(weddingWebsiteId).stream()
                .mapToInt(WeddingPartyMember::sortOrder).max().orElse(-1) + 1;
        WeddingPartyMember member = new WeddingPartyMember(
                null, weddingWebsiteId, req.name(), req.role(), req.side(),
                req.bio(), req.photoUrl(), nextSort,
                LocalDateTime.now(), LocalDateTime.now(),
                null, null, null  // unframed until the couple repositions the avatar
        );
        WeddingPartyMember saved = repository.save(member);
        log.info("wedding party member added, websiteId={}, memberId={}", weddingWebsiteId, saved.id());
        return saved;
    }

    @Transactional
    public WeddingPartyMember updateMember(UUID weddingWebsiteId, UUID memberId, UpdateWeddingPartyMemberRequest req) {
        WeddingPartyMember existing = getMember(weddingWebsiteId, memberId);
        WeddingPartyMember updated = new WeddingPartyMember(
                existing.id(), existing.weddingWebsiteId(),
                req.name()      != null ? req.name()      : existing.name(),
                req.role()      != null ? req.role()      : existing.role(),
                req.side()      != null ? req.side()      : existing.side(),
                req.bio()       != null ? req.bio()       : existing.bio(),
                req.photoUrl()  != null ? req.photoUrl()  : existing.photoUrl(),
                req.sortOrder() != null ? req.sortOrder() : existing.sortOrder(),
                existing.createdAt(), LocalDateTime.now(),
                req.focalPointX() != null ? req.focalPointX() : existing.focalPointX(),
                req.focalPointY() != null ? req.focalPointY() : existing.focalPointY(),
                req.zoom()        != null ? req.zoom()        : existing.zoom()
        );
        WeddingPartyMember saved = repository.save(updated);
        log.info("wedding party member updated, websiteId={}, memberId={}", weddingWebsiteId, memberId);
        return saved;
    }

    @Transactional
    public void reorderMembers(UUID weddingWebsiteId, List<UUID> orderedIds) {
        List<WeddingPartyMember> current = repository.findAllByWeddingWebsiteId(weddingWebsiteId);
        Set<UUID> currentIds = current.stream().map(WeddingPartyMember::id).collect(Collectors.toSet());
        // A foreign id (one not in this party) is a smuggle attempt against another couple's
        // row, so log it as a security event (observability rule 6).
        if (!currentIds.containsAll(orderedIds)) {
            log.warn("wedding party reorder rejected, foreign id in batch, websiteId={}", weddingWebsiteId);
            throw new IllegalArgumentException("orderedIds contains a member id not in this wedding party");
        }
        // A size or duplicate mismatch (no foreign ids) is almost always a stale client, so
        // reject quietly, no WARN (rule 12).
        if (orderedIds.size() != current.size() || new HashSet<>(orderedIds).size() != current.size()) {
            throw new IllegalArgumentException("orderedIds must contain exactly all member IDs in this wedding party");
        }
        List<WeddingPartyMember> reordered = current.stream()
                .map(m -> new WeddingPartyMember(m.id(), m.weddingWebsiteId(), m.name(), m.role(), m.side(),
                        m.bio(), m.photoUrl(), orderedIds.indexOf(m.id()), m.createdAt(), LocalDateTime.now(),
                        m.focalPointX(), m.focalPointY(), m.zoom()))
                .toList();
        repository.saveAll(reordered);
        log.info("wedding party reordered, websiteId={}, count={}", weddingWebsiteId, reordered.size());
    }

    @Transactional
    public void deleteMember(UUID weddingWebsiteId, UUID memberId) {
        // Load the row (getMember also enforces website ownership) so we can capture its photo blob
        // URL before the row is gone. The blob lives in Azure Storage, not the database, so deleting
        // only the row would orphan the blob in storage forever (issue #101).
        WeddingPartyMember member = getMember(weddingWebsiteId, memberId);
        repository.deleteById(memberId);
        log.info("wedding party member deleted, websiteId={}, memberId={}", weddingWebsiteId, memberId);
        // Delete the member's blob only AFTER the row delete commits (see updatePhotoUrl for the
        // ordering rationale). A null/blank photoUrl triggers no delete.
        deleteOldBlobAfterCommit(weddingWebsiteId, member.photoUrl());
    }

    public WeddingPartyMember getMemberForUpload(UUID weddingWebsiteId, UUID memberId) {
        return getMember(weddingWebsiteId, memberId);
    }

    @Transactional
    public void updatePhotoUrl(UUID weddingWebsiteId, UUID memberId, String photoUrl) {
        WeddingPartyMember existing = getMember(weddingWebsiteId, memberId);
        // Capture the prior blob URL before overwriting it so the replaced blob can be cleaned up
        // once the new URL is durably persisted (issue #101: a re-upload otherwise leaks the old
        // blob in storage forever, growing cost unbounded at scale).
        String oldPhotoUrl = existing.photoUrl();
        // A new photo invalidates the old framing, so reset to centered/no-zoom; the
        // couple repositions the new image from a clean default.
        WeddingPartyMember updated = new WeddingPartyMember(
                existing.id(), existing.weddingWebsiteId(),
                existing.name(), existing.role(), existing.side(),
                existing.bio(), photoUrl, existing.sortOrder(),
                existing.createdAt(), LocalDateTime.now(),
                null, null, null
        );
        repository.save(updated);
        log.info("wedding party member photo updated, websiteId={}, memberId={}", weddingWebsiteId, memberId);
        // Delete the replaced blob only AFTER this transaction commits. A null/blank prior URL (the
        // member had no photo) triggers no delete.
        deleteOldBlobAfterCommit(weddingWebsiteId, oldPhotoUrl);
    }

    // Shared after-commit blob cleanup for the replace and delete paths. Registers the delete to run
    // after the surrounding transaction commits, so a commit-time failure that rolls the write back
    // leaves the old blob intact (the row would still reference it), mirroring the vendor-logo and
    // hero/venue/std paths. With no active transaction (a direct Mockito unit-test call) it runs
    // inline. Delegates to the shared MediaUploadService.deleteBlobBestEffort helper, which no-ops on
    // a null/blank URL and never throws, so a storage failure leaves a logged, recoverable orphan
    // rather than failing an already-committed request.
    private void deleteOldBlobAfterCommit(UUID weddingWebsiteId, String oldUrl) {
        if (oldUrl == null || oldUrl.isBlank()) return;
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    mediaUploadService.deleteBlobBestEffort(oldUrl, BLOB_FIELD, weddingWebsiteId);
                }
            });
        } else {
            mediaUploadService.deleteBlobBestEffort(oldUrl, BLOB_FIELD, weddingWebsiteId);
        }
    }

    private WeddingPartyMember getMember(UUID weddingWebsiteId, UUID memberId) {
        WeddingPartyMember member = repository.findById(memberId)
                .orElseThrow(() -> new WeddingPartyMemberNotFoundException(memberId.toString()));
        if (!member.weddingWebsiteId().equals(weddingWebsiteId)) {
            throw new WeddingPartyMemberNotFoundException(memberId.toString());
        }
        return member;
    }
}
