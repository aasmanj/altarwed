package com.altarwed.application.service;

import com.altarwed.application.dto.CreateSeatingTableRequest;
import com.altarwed.application.dto.UpdateSeatingTableRequest;
import com.altarwed.domain.exception.SeatingTableNotFoundException;
import com.altarwed.domain.model.SeatingTable;
import com.altarwed.domain.port.SeatingTableRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class SeatingTableService {

    private static final Logger log = LoggerFactory.getLogger(SeatingTableService.class);

    private final SeatingTableRepository repository;

    public SeatingTableService(SeatingTableRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<SeatingTable> list(UUID coupleId) {
        return repository.findAllByCoupleId(coupleId);
    }

    @Transactional
    public SeatingTable create(UUID coupleId, CreateSeatingTableRequest req) {
        int nextSort = repository.findAllByCoupleId(coupleId).stream()
                .mapToInt(SeatingTable::sortOrder)
                .max()
                .orElse(-1) + 1;
        int capacity = req.capacity() != null ? req.capacity() : 8;
        SeatingTable table = new SeatingTable(null, coupleId, req.name(), capacity, nextSort, null, null);
        SeatingTable saved = repository.save(table);
        log.info("seating table created, coupleId={}, tableId={}", coupleId, saved.id());
        return saved;
    }

    @Transactional
    public SeatingTable update(UUID coupleId, UUID tableId, UpdateSeatingTableRequest req) {
        SeatingTable existing = get(coupleId, tableId);
        SeatingTable updated = new SeatingTable(
                existing.id(), existing.coupleId(),
                req.name()      != null ? req.name()      : existing.name(),
                req.capacity()  != null ? req.capacity()  : existing.capacity(),
                req.sortOrder() != null ? req.sortOrder() : existing.sortOrder(),
                existing.createdAt(), LocalDateTime.now()
        );
        SeatingTable saved = repository.save(updated);
        log.info("seating table updated, coupleId={}, tableId={}", coupleId, saved.id());
        return saved;
    }

    @Transactional
    public void delete(UUID coupleId, UUID tableId) {
        if (!repository.existsByIdAndCoupleId(tableId, coupleId)) {
            throw new SeatingTableNotFoundException(tableId.toString());
        }
        repository.deleteById(tableId);
        log.info("seating table deleted, coupleId={}, tableId={}", coupleId, tableId);
    }

    private SeatingTable get(UUID coupleId, UUID tableId) {
        return repository.findById(tableId)
                .filter(t -> t.coupleId().equals(coupleId))
                .orElseThrow(() -> new SeatingTableNotFoundException(tableId.toString()));
    }
}
