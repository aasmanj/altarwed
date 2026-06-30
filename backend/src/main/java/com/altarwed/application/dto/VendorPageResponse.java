package com.altarwed.application.dto;

import java.util.List;

/**
 * Public directory response for GET /api/v1/vendors: one page of vendors plus the total
 * number of matches across all pages (drives the "Showing N of M" label and prev/next
 * pagination). Replaces the legacy bare-array body. Boxed types per the DTO convention.
 */
public record VendorPageResponse(List<VendorResponse> vendors, Integer total) {}
