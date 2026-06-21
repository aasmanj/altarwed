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

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class WeddingPartyMemberService {

    private static final Logger log = LoggerFactory.getLogger(WeddingPartyMemberService.class);

    private final WeddingPartyMemberRepository repository;

    public WeddingPartyMemberService(WeddingPartyMemberRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<WeddingPartyMember> listMembers(UUID weddingWebsiteId) {
        return repository.findAllByWeddingWebsiteId(weddingWebsiteId);
    }

    @Transactional
    public WeddingPartyMember addMember(UUID weddingWebsiteId, CreateWeddingPartyMemberRequest req) {
        WeddingPartyMember member = new WeddingPartyMember(
                null, weddingWebsiteId, req.name(), req.role(), req.side(),
                req.bio(), req.photoUrl(), req.sortOrder() != null ? req.sortOrder() : 0,
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
    public void deleteMember(UUID weddingWebsiteId, UUID memberId) {
        if (!repository.existsByIdAndWeddingWebsiteId(memberId, weddingWebsiteId)) {
            throw new WeddingPartyMemberNotFoundException(memberId.toString());
        }
        repository.deleteById(memberId);
    }

    public WeddingPartyMember getMemberForUpload(UUID weddingWebsiteId, UUID memberId) {
        return getMember(weddingWebsiteId, memberId);
    }

    @Transactional
    public void updatePhotoUrl(UUID weddingWebsiteId, UUID memberId, String photoUrl) {
        WeddingPartyMember existing = getMember(weddingWebsiteId, memberId);
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
