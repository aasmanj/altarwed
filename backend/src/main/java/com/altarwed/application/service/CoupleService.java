package com.altarwed.application.service;

import com.altarwed.domain.exception.CoupleNotFoundException;
import com.altarwed.domain.model.Couple;
import com.altarwed.domain.port.CoupleRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.UUID;

@Service
public class CoupleService {

    private static final Logger log = LoggerFactory.getLogger(CoupleService.class);

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
        Couple saved = coupleRepository.save(couple.withWeddingDate(weddingDate));
        log.info("couple wedding date updated, coupleId={}, newDate={}", id, weddingDate);
        return saved;
    }

    @Transactional
    public Couple updateDenomination(UUID id, UUID denominationId) {
        Couple couple = getById(id);
        Couple saved = coupleRepository.save(couple.withDenomination(denominationId));
        log.info("couple denomination updated, coupleId={}, denominationId={}", id, denominationId);
        return saved;
    }

    @Transactional
    public void deactivate(UUID id) {
        Couple couple = getById(id);
        coupleRepository.save(couple.deactivated());
        log.info("couple deactivated, coupleId={}", id);
    }
}
