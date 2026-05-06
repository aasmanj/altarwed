package com.altarwed.application.service;

import com.altarwed.application.dto.AddWeddingPhotoRequest;
import com.altarwed.application.dto.UpdateWeddingPhotoRequest;
import com.altarwed.domain.exception.WeddingPhotoNotFoundException;
import com.altarwed.domain.exception.WeddingWebsiteNotFoundException;
import com.altarwed.domain.model.WeddingPhoto;
import com.altarwed.domain.port.WeddingPhotoRepository;
import com.altarwed.domain.port.WeddingWebsiteRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class WeddingPhotoService {

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
        int sortOrder = req.sortOrder() != null ? req.sortOrder() : 0;
        WeddingPhoto photo = new WeddingPhoto(null, websiteId, req.url(), req.caption(), sortOrder, null);
        return photoRepository.save(photo);
    }

    @Transactional
    public WeddingPhoto updatePhoto(UUID websiteId, UUID photoId, UpdateWeddingPhotoRequest req) {
        WeddingPhoto existing = photoRepository.findById(photoId)
                .filter(p -> p.weddingWebsiteId().equals(websiteId))
                .orElseThrow(() -> new WeddingPhotoNotFoundException(photoId.toString()));
        int sortOrder = req.sortOrder() != null ? req.sortOrder() : existing.sortOrder();
        String caption = req.caption() != null ? req.caption() : existing.caption();
        WeddingPhoto updated = new WeddingPhoto(existing.id(), existing.weddingWebsiteId(), existing.url(), caption, sortOrder, existing.createdAt());
        return photoRepository.save(updated);
    }

    @Transactional
    public void deletePhoto(UUID websiteId, UUID photoId) {
        if (!photoRepository.existsByIdAndWeddingWebsiteId(photoId, websiteId)) {
            throw new WeddingPhotoNotFoundException(photoId.toString());
        }
        photoRepository.deleteById(photoId);
    }
}
