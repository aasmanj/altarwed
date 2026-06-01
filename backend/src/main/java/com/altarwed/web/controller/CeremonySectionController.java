package com.altarwed.web.controller;

import com.altarwed.application.dto.CeremonySectionRequest;
import com.altarwed.application.dto.CeremonySectionResponse;
import com.altarwed.application.service.CeremonySectionService;
import com.altarwed.domain.model.CeremonySection;
import com.altarwed.web.security.CoupleAccessGuard;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/ceremony-sections")
public class CeremonySectionController {

    private final CeremonySectionService service;
    private final CoupleAccessGuard accessGuard;

    public CeremonySectionController(CeremonySectionService service, CoupleAccessGuard accessGuard) {
        this.service = service;
        this.accessGuard = accessGuard;
    }

    @GetMapping("/couple/{coupleId}")
    public List<CeremonySectionResponse> list(
            @PathVariable UUID coupleId,
            @AuthenticationPrincipal String email
    ) {
        accessGuard.assertOwns(coupleId, email);
        return service.getByCoupleId(coupleId).stream().map(this::toResponse).toList();
    }

    @PostMapping("/couple/{coupleId}")
    @ResponseStatus(HttpStatus.CREATED)
    public CeremonySectionResponse create(
            @PathVariable UUID coupleId,
            @Valid @RequestBody CeremonySectionRequest req,
            @AuthenticationPrincipal String email
    ) {
        accessGuard.assertOwns(coupleId, email);
        return toResponse(service.create(coupleId, req));
    }

    // Scoped by section id (no path coupleId): resolve the authenticated couple
    // and let the service filter by it (cross-couple = not-found).
    @PutMapping("/{id}")
    public CeremonySectionResponse update(
            @PathVariable UUID id,
            @Valid @RequestBody CeremonySectionRequest req,
            @AuthenticationPrincipal String email
    ) {
        UUID coupleId = accessGuard.requireCoupleId(email);
        return toResponse(service.update(coupleId, id, req));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(
            @PathVariable UUID id,
            @AuthenticationPrincipal String email
    ) {
        UUID coupleId = accessGuard.requireCoupleId(email);
        service.delete(coupleId, id);
    }

    private CeremonySectionResponse toResponse(CeremonySection s) {
        return new CeremonySectionResponse(
                s.id(), s.coupleId(), s.title(), s.sectionType(),
                s.content(), s.sortOrder(), s.createdAt(), s.updatedAt()
        );
    }
}
