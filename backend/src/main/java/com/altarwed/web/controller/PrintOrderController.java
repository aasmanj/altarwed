package com.altarwed.web.controller;

import com.altarwed.application.dto.CreatePrintOrderRequest;
import com.altarwed.application.dto.PrintOrderResponse;
import com.altarwed.application.service.PrintOrderService;
import com.altarwed.web.mapper.PrintOrderMapper;
import com.altarwed.web.security.CoupleAccessGuard;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/print-orders")
public class PrintOrderController {

    private final PrintOrderService printOrderService;
    private final CoupleAccessGuard accessGuard;

    public PrintOrderController(PrintOrderService printOrderService, CoupleAccessGuard accessGuard) {
        this.printOrderService = printOrderService;
        this.accessGuard = accessGuard;
    }

    @PostMapping("/couple/{coupleId}")
    public ResponseEntity<PrintOrderResponse> create(
            @PathVariable UUID coupleId,
            @Valid @RequestBody CreatePrintOrderRequest req,
            @AuthenticationPrincipal String email
    ) {
        accessGuard.assertOwns(coupleId, email);
        return ResponseEntity.ok(PrintOrderMapper.toResponse(printOrderService.createOrder(coupleId, req)));
    }

    @GetMapping("/couple/{coupleId}")
    public ResponseEntity<List<PrintOrderResponse>> list(
            @PathVariable UUID coupleId,
            @AuthenticationPrincipal String email
    ) {
        accessGuard.assertOwns(coupleId, email);
        return ResponseEntity.ok(
                printOrderService.listOrders(coupleId).stream().map(PrintOrderMapper::toResponse).toList()
        );
    }

    // Refresh per-recipient delivery status for one order by polling the mail provider. Couple-scoped
    // and ownership-guarded like the other endpoints here.
    @PostMapping("/couple/{coupleId}/{orderId}/refresh-status")
    public ResponseEntity<PrintOrderResponse> refreshStatus(
            @PathVariable UUID coupleId,
            @PathVariable UUID orderId,
            @AuthenticationPrincipal String email
    ) {
        accessGuard.assertOwns(coupleId, email);
        return ResponseEntity.ok(
                PrintOrderMapper.toResponse(printOrderService.refreshDeliveryStatuses(coupleId, orderId))
        );
    }
}
