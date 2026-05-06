package com.altarwed.web.controller;

import com.altarwed.application.dto.CreateWeddingPartyMemberRequest;
import com.altarwed.application.dto.UpdateWeddingPartyMemberRequest;
import com.altarwed.application.dto.WeddingPartyMemberResponse;
import com.altarwed.application.service.WeddingPartyMemberService;
import com.altarwed.web.mapper.WeddingPartyMemberMapper;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/wedding-party")
public class WeddingPartyMemberController {

    private final WeddingPartyMemberService service;
    private final WeddingPartyMemberMapper mapper;

    public WeddingPartyMemberController(WeddingPartyMemberService service, WeddingPartyMemberMapper mapper) {
        this.service = service;
        this.mapper = mapper;
    }

    // Public — Next.js wedding page
    @GetMapping("/website/{websiteId}")
    public ResponseEntity<List<WeddingPartyMemberResponse>> list(@PathVariable UUID websiteId) {
        return ResponseEntity.ok(service.listMembers(websiteId).stream().map(mapper::toResponse).toList());
    }

    // Authenticated — couple dashboard
    @PostMapping("/website/{websiteId}")
    public ResponseEntity<WeddingPartyMemberResponse> add(
            @PathVariable UUID websiteId,
            @Valid @RequestBody CreateWeddingPartyMemberRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(mapper.toResponse(service.addMember(websiteId, request)));
    }

    @PatchMapping("/website/{websiteId}/{memberId}")
    public ResponseEntity<WeddingPartyMemberResponse> update(
            @PathVariable UUID websiteId,
            @PathVariable UUID memberId,
            @Valid @RequestBody UpdateWeddingPartyMemberRequest request
    ) {
        return ResponseEntity.ok(mapper.toResponse(service.updateMember(websiteId, memberId, request)));
    }

    @DeleteMapping("/website/{websiteId}/{memberId}")
    public ResponseEntity<Void> delete(
            @PathVariable UUID websiteId,
            @PathVariable UUID memberId
    ) {
        service.deleteMember(websiteId, memberId);
        return ResponseEntity.noContent().build();
    }
}
