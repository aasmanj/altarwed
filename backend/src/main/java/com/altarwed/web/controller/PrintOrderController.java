package com.altarwed.web.controller;

import com.altarwed.application.dto.CreatePrintOrderRequest;
import com.altarwed.application.dto.CreateTestPrintOrderRequest;
import com.altarwed.application.dto.PrintOrderCreateResponse;
import com.altarwed.application.dto.PrintOrderResponse;
import com.altarwed.application.service.PrintOrderService;
import com.altarwed.web.mapper.PrintOrderMapper;
import com.altarwed.web.security.CoupleAccessGuard;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
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

    // Issue #59: 202, not 200 -- the order is created in PENDING_PAYMENT and nothing has been sent
    // to Lob yet. The couple must complete the returned checkoutUrl before anything mails.
    @PostMapping("/couple/{coupleId}")
    public ResponseEntity<PrintOrderCreateResponse> create(
            @PathVariable UUID coupleId,
            @Valid @RequestBody CreatePrintOrderRequest req,
            @AuthenticationPrincipal String email
    ) {
        accessGuard.assertOwns(coupleId, email);
        return ResponseEntity.status(HttpStatus.ACCEPTED)
                .body(PrintOrderMapper.toCreateResponse(printOrderService.createOrder(coupleId, req)));
    }

    // Issue #208: single self-addressed test postcard so the couple can proof the real printed
    // card before ordering the full batch. Same 202 + Stripe Checkout contract as create above --
    // the proof is a real paid order and nothing mails until payment completes.
    @PostMapping("/couple/{coupleId}/test-proof")
    public ResponseEntity<PrintOrderCreateResponse> createTestProof(
            @PathVariable UUID coupleId,
            @Valid @RequestBody CreateTestPrintOrderRequest req,
            @AuthenticationPrincipal String email
    ) {
        accessGuard.assertOwns(coupleId, email);
        return ResponseEntity.status(HttpStatus.ACCEPTED)
                .body(PrintOrderMapper.toCreateResponse(printOrderService.createTestProofOrder(coupleId, req)));
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
