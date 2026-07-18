package com.altarwed.application.service;

import com.altarwed.domain.exception.PortfolioCapExceededException;
import com.altarwed.domain.model.PlanTier;
import com.altarwed.domain.model.VendorPortfolioPhoto;
import com.altarwed.domain.model.VendorSubscription;
import com.altarwed.domain.port.VendorPortfolioPhotoRepository;
import com.altarwed.domain.port.VendorSubscriptionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

@Service
public class VendorPortfolioPhotoService {

    private static final Logger log = LoggerFactory.getLogger(VendorPortfolioPhotoService.class);

    private final VendorPortfolioPhotoRepository repository;
    private final MediaUploadService mediaUploadService;
    private final VendorSubscriptionRepository subscriptionRepository;

    public VendorPortfolioPhotoService(
            VendorPortfolioPhotoRepository repository,
            MediaUploadService mediaUploadService,
            VendorSubscriptionRepository subscriptionRepository
    ) {
        this.repository = repository;
        this.mediaUploadService = mediaUploadService;
        this.subscriptionRepository = subscriptionRepository;
    }

    /**
     * Issue #370 pricing ladder: the portfolio cap follows the vendor's EFFECTIVE tier (25 for an
     * ACTIVE/TRIALING Premium, 10 otherwise, including no subscription row at all), so a lapsed
     * Premium stops accruing photos beyond the base cap the moment the webhook downgrades it.
     * Photos already uploaded above a shrunken cap are kept (the cap gates adds, it never deletes
     * paid-for content); the vendor just cannot add more until below the cap again.
     */
    private int photoCapFor(UUID vendorId) {
        return subscriptionRepository.findByVendorId(vendorId)
                .map(VendorSubscription::effectivePlanTier)
                .orElse(PlanTier.BASIC)
                .portfolioPhotoCap();
    }

    @Transactional
    public VendorPortfolioPhoto addPhoto(UUID vendorId, MultipartFile file, String caption) throws IOException {
        log.info("vendor portfolio photo upload started, vendorId={}", vendorId);
        int cap = photoCapFor(vendorId);
        int current = repository.countByVendorId(vendorId);
        if (current >= cap) {
            log.warn("vendor portfolio cap exceeded, vendorId={}, cap={}", vendorId, cap);
            throw new PortfolioCapExceededException(cap);
        }
        // Server-authoritative append position: max(sortOrder)+1, not the photo count. After a
        // middle photo is deleted the count no longer equals the next free slot, so a count-based
        // sortOrder would collide with an existing photo. The cap above still uses the count, which
        // is correct for a cap. Mirrors WeddingPhotoService and WeddingPartyMemberService.
        int nextSort = repository.findAllByVendorId(vendorId).stream()
                .mapToInt(VendorPortfolioPhoto::sortOrder)
                .max()
                .orElse(-1) + 1;
        String photoUrl = mediaUploadService.uploadVendorPortfolioPhoto(vendorId, file);
        VendorPortfolioPhoto photo = new VendorPortfolioPhoto(
                null,
                vendorId,
                photoUrl,
                (caption != null && !caption.isBlank()) ? caption.trim() : null,
                nextSort,
                null
        );
        VendorPortfolioPhoto saved = repository.save(photo);
        log.info("vendor portfolio photo saved, vendorId={}, photoId={}", vendorId, saved.id());
        return saved;
    }

    @Transactional(readOnly = true)
    public List<VendorPortfolioPhoto> listPhotos(UUID vendorId) {
        return repository.findAllByVendorId(vendorId);
    }

    @Transactional
    public void deletePhoto(UUID vendorId, UUID photoId) {
        log.info("vendor portfolio photo delete started, vendorId={}, photoId={}", vendorId, photoId);
        VendorPortfolioPhoto photo = repository.findById(photoId).orElseThrow(() -> {
            log.warn("vendor portfolio photo delete rejected, not found or wrong owner, vendorId={}, photoId={}", vendorId, photoId);
            return new AccessDeniedException("photo does not belong to this vendor");
        });
        if (!photo.vendorId().equals(vendorId)) {
            log.warn("vendor portfolio photo delete rejected, not found or wrong owner, vendorId={}, photoId={}", vendorId, photoId);
            throw new AccessDeniedException("photo does not belong to this vendor");
        }
        repository.deleteById(photoId);
        log.info("vendor portfolio photo deleted, vendorId={}, photoId={}", vendorId, photoId);
    }

    @Transactional
    public void reorderPhotos(UUID vendorId, List<UUID> orderedIds) {
        log.info("vendor portfolio reorder started, vendorId={}", vendorId);
        List<VendorPortfolioPhoto> current = repository.findAllByVendorId(vendorId);
        // Require orderedIds to be a permutation of all owned IDs -- no extras, no omissions, no duplicates.
        if (orderedIds.size() != current.size() || !current.stream().map(VendorPortfolioPhoto::id).allMatch(orderedIds::contains)) {
            throw new IllegalArgumentException("orderedIds must contain exactly all photo IDs belonging to this vendor");
        }
        List<VendorPortfolioPhoto> reordered = orderedIds.stream()
                .map(id -> {
                    VendorPortfolioPhoto p = current.stream().filter(x -> x.id().equals(id)).findFirst().orElseThrow();
                    return new VendorPortfolioPhoto(p.id(), p.vendorId(), p.photoUrl(), p.caption(), orderedIds.indexOf(id), p.createdAt());
                })
                .toList();
        repository.saveAll(reordered);
        log.info("vendor portfolio reorder complete, vendorId={}", vendorId);
    }

    @Transactional
    public VendorPortfolioPhoto updateCaption(UUID vendorId, UUID photoId, String caption) {
        log.info("vendor portfolio caption update started, vendorId={}, photoId={}", vendorId, photoId);
        VendorPortfolioPhoto existing = repository.findById(photoId).orElseThrow(() -> {
            log.warn("vendor portfolio caption update rejected, not found or wrong owner, vendorId={}, photoId={}", vendorId, photoId);
            return new AccessDeniedException("photo does not belong to this vendor");
        });
        if (!existing.vendorId().equals(vendorId)) {
            log.warn("vendor portfolio caption update rejected, not found or wrong owner, vendorId={}, photoId={}", vendorId, photoId);
            throw new AccessDeniedException("photo does not belong to this vendor");
        }
        VendorPortfolioPhoto updated = new VendorPortfolioPhoto(
                existing.id(),
                existing.vendorId(),
                existing.photoUrl(),
                (caption != null && !caption.isBlank()) ? caption.trim() : null,
                existing.sortOrder(),
                existing.createdAt()
        );
        VendorPortfolioPhoto saved = repository.save(updated);
        log.info("vendor portfolio caption updated, vendorId={}, photoId={}", vendorId, photoId);
        return saved;
    }
}
