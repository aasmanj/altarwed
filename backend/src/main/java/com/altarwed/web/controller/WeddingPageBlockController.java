package com.altarwed.web.controller;

import com.altarwed.application.dto.CreateWeddingPageBlockRequest;
import com.altarwed.application.dto.ReorderBlocksRequest;
import com.altarwed.application.dto.UpdateWeddingPageBlockRequest;
import com.altarwed.application.dto.WeddingPageBlockResponse;
import com.altarwed.application.service.WeddingPageBlockService;
import com.altarwed.application.service.WeddingWebsiteService;
import com.altarwed.domain.model.BlockTab;
import com.altarwed.web.mapper.WeddingPageBlockMapper;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/wedding-page-blocks")
public class WeddingPageBlockController {

    private final WeddingPageBlockService blockService;
    private final WeddingWebsiteService websiteService;
    private final WeddingPageBlockMapper mapper;

    public WeddingPageBlockController(
            WeddingPageBlockService blockService,
            WeddingWebsiteService websiteService,
            WeddingPageBlockMapper mapper
    ) {
        this.blockService = blockService;
        this.websiteService = websiteService;
        this.mapper = mapper;
    }

    // ----- Public (SSR consumer) -----

    // Returns blocks for any tab of a PUBLISHED wedding site. Used by Next.js SSR pages.
    // For unpublished sites, getBySlug throws → handled as 404 by GlobalExceptionHandler.
    @GetMapping("/slug/{slug}")
    public ResponseEntity<List<WeddingPageBlockResponse>> listBySlug(
            @PathVariable String slug,
            @RequestParam(required = false) BlockTab tab
    ) {
        var website = websiteService.getBySlug(slug);
        var blocks = tab != null
                ? blockService.listByWebsiteAndTab(website.id(), tab)
                : blockService.listByWebsite(website.id());
        return ResponseEntity.ok(blocks.stream().map(mapper::toResponse).toList());
    }

    // ----- Authenticated (couple dashboard) -----

    @GetMapping("/website/{websiteId}")
    public ResponseEntity<List<WeddingPageBlockResponse>> listByWebsite(@PathVariable UUID websiteId) {
        return ResponseEntity.ok(
                blockService.listByWebsite(websiteId).stream().map(mapper::toResponse).toList()
        );
    }

    @PostMapping("/website/{websiteId}")
    public ResponseEntity<WeddingPageBlockResponse> create(
            @PathVariable UUID websiteId,
            @Valid @RequestBody CreateWeddingPageBlockRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(mapper.toResponse(blockService.create(websiteId, request)));
    }

    @PatchMapping("/website/{websiteId}/{blockId}")
    public ResponseEntity<WeddingPageBlockResponse> update(
            @PathVariable UUID websiteId,
            @PathVariable UUID blockId,
            @Valid @RequestBody UpdateWeddingPageBlockRequest request
    ) {
        return ResponseEntity.ok(mapper.toResponse(blockService.update(websiteId, blockId, request)));
    }

    @DeleteMapping("/website/{websiteId}/{blockId}")
    public ResponseEntity<Void> delete(
            @PathVariable UUID websiteId,
            @PathVariable UUID blockId
    ) {
        blockService.delete(websiteId, blockId);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/website/{websiteId}/tab/{tab}/reorder")
    public ResponseEntity<List<WeddingPageBlockResponse>> reorder(
            @PathVariable UUID websiteId,
            @PathVariable BlockTab tab,
            @Valid @RequestBody ReorderBlocksRequest request
    ) {
        return ResponseEntity.ok(
                blockService.reorder(websiteId, tab, request).stream().map(mapper::toResponse).toList()
        );
    }
}
