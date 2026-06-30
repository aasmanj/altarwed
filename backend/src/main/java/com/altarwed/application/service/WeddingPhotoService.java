package com.altarwed.application.service;

import com.altarwed.application.dto.AddWeddingPhotoRequest;
import com.altarwed.application.dto.UpdateWeddingPhotoRequest;
import com.altarwed.domain.exception.WeddingPhotoNotFoundException;
import com.altarwed.domain.exception.WeddingWebsiteNotFoundException;
import com.altarwed.domain.model.WeddingPhoto;
import com.altarwed.domain.port.WeddingPhotoRepository;
import com.altarwed.domain.port.WeddingWebsiteRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class WeddingPhotoService {

    private static final Logger log = LoggerFactory.getLogger(WeddingPhotoService.class);

    private final WeddingPhotoRepository photoRepository;
    private final WeddingWebsiteRepository websiteRepository;

    public WeddingPhotoService(WeddingPhotoRepository photoRepository, WeddingWebsiteRepository websiteRepository) {
        this.photoRepository = photoRepository;
        this.websiteRepository = websiteRepository;
    }

    @Transactional(readOnly = true)
    public List<WeddingPhoto> listPhotos(UUID websiteId) {
        return photoRepository.findAllByWeddingWebsiteId(websiteId);
    }

    @Transactional(readOnly = true)
    public List<WeddingPhoto> listPhotosBySlug(String slug) {
        var website = websiteRepository.findBySlug(slug)
                .orElseThrow(() -> new WeddingWebsiteNotFoundException(slug));
        return photoRepository.findAllByWeddingWebsiteId(website.id());
    }

    @Transactional
    public WeddingPhoto addPhoto(UUID websiteId, AddWeddingPhotoRequest req) {
        websiteRepository.findById(websiteId)
                .orElseThrow(() -> new WeddingWebsiteNotFoundException(websiteId.toString()));
        // Server-authoritative append position: max(sortOrder)+1, not the client's value and not
        // the album count. After a delete the count no longer equals the next free slot, so a
        // count-based (or stale/hostile client) sortOrder would collide with an existing photo.
        int sortOrder = photoRepository.findAllByWeddingWebsiteId(websiteId).stream()
                .mapToInt(WeddingPhoto::sortOrder).max().orElse(-1) + 1;
        // A new upload starts unframed (centered, no zoom); the couple repositions it later.
        WeddingPhoto photo = new WeddingPhoto(null, websiteId, req.url(), req.caption(), sortOrder, null, null, null, null);
        WeddingPhoto saved = photoRepository.save(photo);
        log.info("wedding photo added, websiteId={}, photoId={}", websiteId, saved.id());
        return saved;
    }

    @Transactional
    public WeddingPhoto updatePhoto(UUID websiteId, UUID photoId, UpdateWeddingPhotoRequest req) {
        WeddingPhoto existing = photoRepository.findById(photoId)
                .filter(p -> p.weddingWebsiteId().equals(websiteId))
                .orElseThrow(() -> new WeddingPhotoNotFoundException(photoId.toString()));
        int sortOrder = req.sortOrder() != null ? req.sortOrder() : existing.sortOrder();
        String caption = req.caption() != null ? req.caption() : existing.caption();
        // null = leave the field unchanged (the reposition PATCH sends only focal/zoom).
        WeddingPhoto updated = new WeddingPhoto(existing.id(), existing.weddingWebsiteId(), existing.url(), caption, sortOrder, existing.createdAt(),
                req.focalPointX() != null ? req.focalPointX() : existing.focalPointX(),
                req.focalPointY() != null ? req.focalPointY() : existing.focalPointY(),
                req.zoom() != null ? req.zoom() : existing.zoom());
        WeddingPhoto saved = photoRepository.save(updated);
        log.info("wedding photo updated, websiteId={}, photoId={}", websiteId, photoId);
        return saved;
    }

    @Transactional
    public void reorderPhotos(UUID websiteId, List<UUID> orderedIds) {
        List<WeddingPhoto> current = photoRepository.findAllByWeddingWebsiteId(websiteId);
        Set<UUID> currentIds = current.stream().map(WeddingPhoto::id).collect(Collectors.toSet());
        // A foreign id (one not in this album) is a smuggle attempt against another couple's
        // row, so log it as a security event (observability rule 6).
        if (!currentIds.containsAll(orderedIds)) {
            log.warn("photo reorder rejected, foreign id in batch, websiteId={}", websiteId);
            throw new IllegalArgumentException("orderedIds contains a photo id not in this album");
        }
        // A size or duplicate mismatch (no foreign ids) is almost always a stale client (a
        // photo was added/removed in another tab), so reject quietly, no WARN (rule 12).
        if (orderedIds.size() != current.size() || new HashSet<>(orderedIds).size() != current.size()) {
            throw new IllegalArgumentException("orderedIds must contain exactly all photo IDs in this album");
        }
        List<WeddingPhoto> reordered = current.stream()
                .map(p -> new WeddingPhoto(p.id(), p.weddingWebsiteId(), p.url(), p.caption(),
                        orderedIds.indexOf(p.id()), p.createdAt(),
                        p.focalPointX(), p.focalPointY(), p.zoom()))
                .toList();
        photoRepository.saveAll(reordered);
        log.info("wedding photo album reordered, websiteId={}, count={}", websiteId, reordered.size());
    }

    // Returns the URL of the deleted photo so the controller can delete its blob after this delete
    // commits (issue #101: the row delete alone leaves the blob orphaned in storage). Uses findById +
    // ownership filter (like updatePhoto) so the same read both authorizes and yields the URL.
    @Transactional
    public String deletePhoto(UUID websiteId, UUID photoId) {
        WeddingPhoto photo = photoRepository.findById(photoId)
                .filter(p -> p.weddingWebsiteId().equals(websiteId))
                .orElseThrow(() -> new WeddingPhotoNotFoundException(photoId.toString()));
        photoRepository.deleteById(photoId);
        log.info("wedding photo deleted, websiteId={}, photoId={}", websiteId, photoId);
        return photo.url();
    }
}
