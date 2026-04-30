package com.altarwed.application.service;

import com.altarwed.domain.exception.CoupleNotFoundException;
import com.altarwed.domain.model.Couple;
import com.altarwed.domain.port.CoupleRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.UUID;

@Service
public class CoupleService {

    private final CoupleRepository coupleRepository;

    public CoupleService(CoupleRepository coupleRepository) {
        this.coupleRepository = coupleRepository;
    }

    @Transactional(readOnly = true)
    public Couple getById(UUID id) {
        return coupleRepository.findById(id)
                .orElseThrow(() -> new CoupleNotFoundException(id));
    }

    @Transactional
    public Couple updateWeddingDate(UUID id, LocalDate weddingDate) {
        Couple couple = getById(id);
        return coupleRepository.save(couple.withWeddingDate(weddingDate));
    }

    @Transactional
    public Couple updateDenomination(UUID id, UUID denominationId) {
        Couple couple = getById(id);
        return coupleRepository.save(couple.withDenomination(denominationId));
    }

    @Transactional
    public void deactivate(UUID id) {
        Couple couple = getById(id);
        coupleRepository.save(couple.deactivated());
    }
}
