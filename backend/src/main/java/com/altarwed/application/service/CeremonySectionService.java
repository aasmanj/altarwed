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

    @Transactional
    public CeremonySection update(UUID id, CeremonySectionRequest req) {
        CeremonySection existing = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Ceremony section not found: " + id));
        CeremonySection updated = new CeremonySection(
                existing.id(), existing.coupleId(), req.title(), req.sectionType(),
                req.content(), req.sortOrder(), existing.createdAt(), LocalDateTime.now()
        );
        return repository.save(updated);
    }

    @Transactional
    public void delete(UUID id) {
        repository.deleteById(id);
    }
}
