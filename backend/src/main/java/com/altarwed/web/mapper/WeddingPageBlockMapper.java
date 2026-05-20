package com.altarwed.web.mapper;

import com.altarwed.application.dto.WeddingPageBlockResponse;
import com.altarwed.domain.model.WeddingPageBlock;
import org.springframework.stereotype.Component;

@Component
public class WeddingPageBlockMapper {

    public WeddingPageBlockResponse toResponse(WeddingPageBlock b) {
        return new WeddingPageBlockResponse(
                b.id(), b.weddingWebsiteId(), b.tab(), b.type(),
                b.sortOrder(), b.contentJson(),
                b.createdAt(), b.updatedAt()
        );
    }
}
