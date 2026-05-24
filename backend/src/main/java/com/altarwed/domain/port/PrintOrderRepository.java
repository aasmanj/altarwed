package com.altarwed.domain.port;

import com.altarwed.domain.model.PrintOrder;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PrintOrderRepository {
    PrintOrder save(PrintOrder order);
    Optional<PrintOrder> findById(UUID id);
    List<PrintOrder> findAllByCoupleId(UUID coupleId);
}
