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
        log.info("couple wedding date updated, coupleId={}, newDate={}", id, weddingDate);
        Couple couple = getById(id);
        return coupleRepository.save(couple.withWeddingDate(weddingDate));
    }

    @Transactional
    public Couple updateDenomination(UUID id, UUID denominationId) {
        log.info("couple denomination updated, coupleId={}, denominationId={}", id, denominationId);
        Couple couple = getById(id);
        return coupleRepository.save(couple.withDenomination(denominationId));
    }

    @Transactional
    public void deactivate(UUID id) {
        log.info("couple deactivated, coupleId={}", id);
        Couple couple = getById(id);
        coupleRepository.save(couple.deactivated());
    }
}
