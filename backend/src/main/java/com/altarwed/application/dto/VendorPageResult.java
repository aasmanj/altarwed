package com.altarwed.application.dto;

import com.altarwed.domain.model.Vendor;

import java.util.List;

/**
 * Internal carrier for one page of public directory results plus the total number of
 * matches across all pages, so the web layer can render the "Showing N of M" label and
 * prev/next controls. Holds domain {@link Vendor}s; the web layer maps each to a
 * {@link VendorResponse} inside a {@link VendorPageResponse}. total is boxed per the
 * project DTO convention (no primitives in dto records).
 */
public record VendorPageResult(List<Vendor> vendors, Integer total) {}
