package com.altarwed.domain.port;

import com.altarwed.domain.model.WeddingPartyMember;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WeddingPartyMemberRepository {
    WeddingPartyMember save(WeddingPartyMember member);
    List<WeddingPartyMember> findAllByWeddingWebsiteId(UUID weddingWebsiteId);
    Optional<WeddingPartyMember> findById(UUID id);
    void deleteById(UUID id);
    boolean existsByIdAndWeddingWebsiteId(UUID id, UUID weddingWebsiteId);
}
