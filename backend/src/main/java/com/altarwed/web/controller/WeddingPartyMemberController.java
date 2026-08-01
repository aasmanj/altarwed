package com.altarwed.web.controller;

import com.altarwed.application.dto.CreateWeddingPartyMemberRequest;
import com.altarwed.application.dto.ReorderWeddingPartyRequest;
import com.altarwed.application.dto.UpdateWeddingPartyMemberRequest;
import com.altarwed.application.dto.WeddingPartyMemberResponse;
import com.altarwed.application.service.WeddingPartyMemberService;
import com.altarwed.application.service.WeddingWebsiteService;
import com.altarwed.domain.exception.WeddingWebsiteNotFoundException;
import com.altarwed.domain.model.WeddingWebsite;
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
    private final WeddingWebsiteService websiteService;

    public WeddingPartyMemberController(WeddingPartyMemberService service, WeddingPartyMemberMapper mapper,
                                        CoupleAccessGuard accessGuard, WeddingWebsiteService websiteService) {
        this.service = service;
        this.mapper = mapper;
        this.accessGuard = accessGuard;
        this.websiteService = websiteService;
    }

    // Public, Next.js wedding page AND the couple dashboard list. Draft gate (#536):
    // a published site's party is public; a draft's party is visible only to its owner
    // (the dashboard attaches its JWT even though this route is permitAll). Everyone
    // else gets the same 404 a nonexistent site would, so the id leaks nothing.
    @GetMapping("/website/{websiteId}")
    public ResponseEntity<List<WeddingPartyMemberResponse>> list(
            @PathVariable UUID websiteId,
            @AuthenticationPrincipal String email
    ) {
        WeddingWebsite website = websiteService.getByIdForVisibilityCheck(websiteId);
        if (!website.isPublished() && !accessGuard.owns(website.coupleId(), email)) {
            throw new WeddingWebsiteNotFoundException(websiteId);
        }
        return ResponseEntity.ok(service.listMembers(websiteId).stream().map(mapper::toResponse).toList());
    }

    // Owner-editor preview counterpart, mirrors WeddingPhotoController's
    // /website/preview/{slug}: the frontend-public preview iframe cannot attach the
    // couple's JWT across origins, so the slug is the capability and drafts are
    // deliberately reachable here (see WeddingWebsiteService.getBySlugForPreview).
    @GetMapping("/website/preview/{slug}")
    public ResponseEntity<List<WeddingPartyMemberResponse>> listForPreview(@PathVariable String slug) {
        WeddingWebsite website = websiteService.getBySlugForPreview(slug);
        return ResponseEntity.ok(service.listMembers(website.id()).stream().map(mapper::toResponse).toList());
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

    @PatchMapping("/website/{websiteId}/reorder")
    public ResponseEntity<Void> reorder(
            @PathVariable UUID websiteId,
            @Valid @RequestBody ReorderWeddingPartyRequest request,
            @AuthenticationPrincipal String email
    ) {
        accessGuard.assertOwnsWebsite(websiteId, email);
        service.reorderMembers(websiteId, request.orderedIds());
        return ResponseEntity.noContent().build();
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
