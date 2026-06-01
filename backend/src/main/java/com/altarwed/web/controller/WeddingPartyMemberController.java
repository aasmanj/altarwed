package com.altarwed.web.controller;

import com.altarwed.application.dto.CreateWeddingPartyMemberRequest;
import com.altarwed.application.dto.UpdateWeddingPartyMemberRequest;
import com.altarwed.application.dto.WeddingPartyMemberResponse;
import com.altarwed.application.service.WeddingPartyMemberService;
import com.altarwed.web.mapper.WeddingPartyMemberMapper;
import com.altarwed.web.security.CoupleAccessGuard;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/wedding-party")
public class WeddingPartyMemberController {

    private final WeddingPartyMemberService service;
    private final WeddingPartyMemberMapper mapper;
    private final CoupleAccessGuard accessGuard;

    public WeddingPartyMemberController(WeddingPartyMemberService service, WeddingPartyMemberMapper mapper, CoupleAccessGuard accessGuard) {
        this.service = service;
        this.mapper = mapper;
        this.accessGuard = accessGuard;
    }

    // Public, Next.js wedding page
    @GetMapping("/website/{websiteId}")
    public ResponseEntity<List<WeddingPartyMemberResponse>> list(@PathVariable UUID websiteId) {
        return ResponseEntity.ok(service.listMembers(websiteId).stream().map(mapper::toResponse).toList());
    }

    // Authenticated, couple dashboard
    @PostMapping("/website/{websiteId}")
    public ResponseEntity<WeddingPartyMemberResponse> add(
            @PathVariable UUID websiteId,
            @Valid @RequestBody CreateWeddingPartyMemberRequest request,
            @AuthenticationPrincipal String email
    ) {
        accessGuard.assertOwnsWebsite(websiteId, email);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(mapper.toResponse(service.addMember(websiteId, request)));
    }

    @PatchMapping("/website/{websiteId}/{memberId}")
    public ResponseEntity<WeddingPartyMemberResponse> update(
            @PathVariable UUID websiteId,
            @PathVariable UUID memberId,
            @Valid @RequestBody UpdateWeddingPartyMemberRequest request,
            @AuthenticationPrincipal String email
    ) {
        accessGuard.assertOwnsWebsite(websiteId, email);
        return ResponseEntity.ok(mapper.toResponse(service.updateMember(websiteId, memberId, request)));
    }

    @DeleteMapping("/website/{websiteId}/{memberId}")
    public ResponseEntity<Void> delete(
            @PathVariable UUID websiteId,
            @PathVariable UUID memberId,
            @AuthenticationPrincipal String email
    ) {
        accessGuard.assertOwnsWebsite(websiteId, email);
        service.deleteMember(websiteId, memberId);
        return ResponseEntity.noContent().build();
    }
}
