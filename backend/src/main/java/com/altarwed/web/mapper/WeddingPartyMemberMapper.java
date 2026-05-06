package com.altarwed.web.mapper;

import com.altarwed.application.dto.WeddingPartyMemberResponse;
import com.altarwed.domain.model.WeddingPartyMember;
import org.springframework.stereotype.Component;

@Component
public class WeddingPartyMemberMapper {

    public WeddingPartyMemberResponse toResponse(WeddingPartyMember m) {
        return new WeddingPartyMemberResponse(
                m.id(), m.weddingWebsiteId(), m.name(), m.role(),
                m.side(), m.bio(), m.photoUrl(), m.sortOrder()
        );
    }
}
