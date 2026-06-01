package com.altarwed.application.service;

import com.altarwed.application.dto.CeremonySectionRequest;
import com.altarwed.domain.model.CeremonySection;
import com.altarwed.domain.port.CeremonySectionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class CeremonySectionService {

    private final CeremonySectionRepository repository;

    public CeremonySectionService(CeremonySectionRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<CeremonySection> getByCoupleId(UUID coupleId) {
        return repository.findByCoupleIdOrderBySortOrder(coupleId);
    }

    @Transactional
    public CeremonySection create(UUID coupleId, CeremonySectionRequest req) {
        CeremonySection section = new CeremonySection(
                null, coupleId, req.title(), req.sectionType(),
                req.content(), req.sortOrder(), LocalDateTime.now(), LocalDateTime.now()
        );
        return repository.save(section);
    }

    // update/delete are scoped by section id (no path coupleId), so the caller
    // passes the authenticated couple's id and we filter by it: a section owned by
    // another couple is treated as not-found, no cross-couple access, no existence
    // leak. (Security fix, was previously editable/deletable by any couple.)
    @Transactional
    public CeremonySection update(UUID coupleId, UUID id, CeremonySectionRequest req) {
        CeremonySection existing = repository.findById(id)
                .filter(s -> s.coupleId().equals(coupleId))
                .orElseThrow(() -> new IllegalArgumentException("Ceremony section not found: " + id));
        CeremonySection updated = new CeremonySection(
                existing.id(), existing.coupleId(), req.title(), req.sectionType(),
                req.content(), req.sortOrder(), existing.createdAt(), LocalDateTime.now()
        );
        return repository.save(updated);
    }

    @Transactional
    public void delete(UUID coupleId, UUID id) {
        repository.findById(id)
                .filter(s -> s.coupleId().equals(coupleId))
                .orElseThrow(() -> new IllegalArgumentException("Ceremony section not found: " + id));
        repository.deleteById(id);
    }
}
