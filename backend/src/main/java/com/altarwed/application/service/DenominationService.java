package com.altarwed.application.service;

import com.altarwed.domain.exception.DenominationNotFoundException;
import com.altarwed.domain.model.Denomination;
import com.altarwed.domain.port.DenominationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class DenominationService {

    private final DenominationRepository denominationRepository;

    public DenominationService(DenominationRepository denominationRepository) {
        this.denominationRepository = denominationRepository;
    }

    @Transactional(readOnly = true)
    public List<Denomination> getAll() {
        return denominationRepository.findAll();
    }

    @Transactional(readOnly = true)
    public Denomination getById(UUID id) {
        return denominationRepository.findById(id)
                .orElseThrow(() -> new DenominationNotFoundException(id));
    }

    @Transactional(readOnly = true)
    public Denomination getBySlug(String slug) {
        return denominationRepository.findBySlug(slug)
                .orElseThrow(() -> new DenominationNotFoundException(slug));
    }
}
