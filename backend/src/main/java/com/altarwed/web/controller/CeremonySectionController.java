package com.altarwed.web.controller;

import com.altarwed.application.dto.CeremonySectionRequest;
import com.altarwed.application.dto.CeremonySectionResponse;
import com.altarwed.application.service.CeremonySectionService;
import com.altarwed.domain.model.CeremonySection;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/ceremony-sections")
public class CeremonySectionController {

    private final CeremonySectionService service;

    public CeremonySectionController(CeremonySectionService service) {
        this.service = service;
    }

    @GetMapping("/couple/{coupleId}")
    public List<CeremonySectionResponse> list(@PathVariable UUID coupleId) {
        return service.getByCoupleId(coupleId).stream().map(this::toResponse).toList();
    }

    @PostMapping("/couple/{coupleId}")
    @ResponseStatus(HttpStatus.CREATED)
    public CeremonySectionResponse create(
            @PathVariable UUID coupleId,
            @Valid @RequestBody CeremonySectionRequest req
    ) {
        return toResponse(service.create(coupleId, req));
    }

    @PutMapping("/{id}")
    public CeremonySectionResponse update(
            @PathVariable UUID id,
            @Valid @RequestBody CeremonySectionRequest req
    ) {
        return toResponse(service.update(id, req));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        service.delete(id);
    }

    private CeremonySectionResponse toResponse(CeremonySection s) {
        return new CeremonySectionResponse(
                s.id(), s.coupleId(), s.title(), s.sectionType(),
                s.content(), s.sortOrder(), s.createdAt(), s.updatedAt()
        );
    }
}
