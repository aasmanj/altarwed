package com.altarwed.web.controller;

import com.altarwed.application.dto.CreatePrintOrderRequest;
import com.altarwed.application.dto.PrintOrderResponse;
import com.altarwed.application.service.PrintOrderService;
import com.altarwed.web.mapper.PrintOrderMapper;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/print-orders")
public class PrintOrderController {

    private final PrintOrderService printOrderService;

    public PrintOrderController(PrintOrderService printOrderService) {
        this.printOrderService = printOrderService;
    }

    @PostMapping("/couple/{coupleId}")
    public ResponseEntity<PrintOrderResponse> create(
            @PathVariable UUID coupleId,
            @Valid @RequestBody CreatePrintOrderRequest req
    ) {
        return ResponseEntity.ok(PrintOrderMapper.toResponse(printOrderService.createOrder(coupleId, req)));
    }

    @GetMapping("/couple/{coupleId}")
    public ResponseEntity<List<PrintOrderResponse>> list(@PathVariable UUID coupleId) {
        return ResponseEntity.ok(
                printOrderService.listOrders(coupleId).stream().map(PrintOrderMapper::toResponse).toList()
        );
    }
}
