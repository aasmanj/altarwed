package com.altarwed.web.controller;

import com.altarwed.application.dto.CreatePrintOrderRequest;
import com.altarwed.application.dto.PrintOrderResponse;
import com.altarwed.application.service.PrintOrderService;
import com.altarwed.domain.port.CoupleRepository;
import com.altarwed.web.mapper.PrintOrderMapper;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/print-orders")
public class PrintOrderController {

    private final PrintOrderService printOrderService;
    private final CoupleRepository coupleRepository;

    public PrintOrderController(PrintOrderService printOrderService, CoupleRepository coupleRepository) {
        this.printOrderService = printOrderService;
        this.coupleRepository = coupleRepository;
    }

    @PostMapping("/couple/{coupleId}")
    public ResponseEntity<PrintOrderResponse> create(
            @PathVariable UUID coupleId,
            @Valid @RequestBody CreatePrintOrderRequest req,
            @AuthenticationPrincipal UserDetails principal
    ) {
        assertOwns(coupleId, principal);
        return ResponseEntity.ok(PrintOrderMapper.toResponse(printOrderService.createOrder(coupleId, req)));
    }

    @GetMapping("/couple/{coupleId}")
    public ResponseEntity<List<PrintOrderResponse>> list(
            @PathVariable UUID coupleId,
            @AuthenticationPrincipal UserDetails principal
    ) {
        assertOwns(coupleId, principal);
        return ResponseEntity.ok(
                printOrderService.listOrders(coupleId).stream().map(PrintOrderMapper::toResponse).toList()
        );
    }

    /**
     * IDOR guard: the JWT principal's email must resolve to the same Couple as the
     * path coupleId. Without this, any authenticated couple could mail postcards
     * on another couple's behalf (and rack up real Lob charges on their account).
     */
    private void assertOwns(UUID coupleId, UserDetails principal) {
        if (principal == null) throw new AccessDeniedException("Unauthenticated");
        UUID authenticatedCoupleId = coupleRepository.findByEmail(principal.getUsername())
                .map(c -> c.id())
                .orElseThrow(() -> new AccessDeniedException("Unknown principal"));
        if (!authenticatedCoupleId.equals(coupleId)) {
            throw new AccessDeniedException("Cannot access another couple's print orders");
        }
    }
}
