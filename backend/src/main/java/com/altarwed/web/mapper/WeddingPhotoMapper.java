package com.altarwed.web.mapper;

import com.altarwed.application.dto.WeddingPhotoResponse;
import com.altarwed.domain.model.WeddingPhoto;
import org.springframework.stereotype.Component;

@Component
public class WeddingPhotoMapper {

    public WeddingPhotoResponse toResponse(WeddingPhoto photo) {
        return new WeddingPhotoResponse(
                photo.id(),
                photo.weddingWebsiteId(),
                photo.url(),
                photo.caption(),
                photo.sortOrder(),
                photo.createdAt()
        );
    }
}
