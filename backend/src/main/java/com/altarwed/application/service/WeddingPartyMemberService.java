package com.altarwed.application.service;

import com.altarwed.application.dto.CreateWeddingPartyMemberRequest;
import com.altarwed.application.dto.UpdateWeddingPartyMemberRequest;
import com.altarwed.domain.exception.WeddingPartyMemberNotFoundException;
import com.altarwed.domain.model.WeddingPartyMember;
import com.altarwed.domain.port.WeddingPartyMemberRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class WeddingPartyMemberService {

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
                req.bio(), req.photoUrl(), req.sortOrder(),
                LocalDateTime.now(), LocalDateTime.now()
        );
        return repository.save(member);
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
                existing.createdAt(), LocalDateTime.now()
        );
        return repository.save(updated);
    }

    @Transactional
    public void deleteMember(UUID weddingWebsiteId, UUID memberId) {
        if (!repository.existsByIdAndWeddingWebsiteId(memberId, weddingWebsiteId)) {
            throw new WeddingPartyMemberNotFoundException(memberId.toString());
        }
        repository.deleteById(memberId);
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
