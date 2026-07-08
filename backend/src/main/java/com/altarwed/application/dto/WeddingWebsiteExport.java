package com.altarwed.application.dto;

import java.util.List;

/**
 * Self-serve data-export payload for a couple's wedding website (issue #253).
 *
 * Bundles the website's scalar fields (via {@link WeddingWebsiteResponse}) with the
 * ordered page-builder blocks (via {@link WeddingPageBlockResponse}) so a couple can
 * download a portable JSON copy of everything they authored. Read-only: this record is
 * serialized to JSON for download and never accepted as input, so it carries no Bean
 * Validation. Boxed types throughout (inherited from the nested response records).
 */
public record WeddingWebsiteExport(
        WeddingWebsiteResponse website,
        List<WeddingPageBlockResponse> blocks
) {}
