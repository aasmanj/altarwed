package com.altarwed.web.controller;

import com.altarwed.application.dto.CreatePrintOrderRequest;
import com.altarwed.application.dto.PrintOrderResponse;
import com.altarwed.application.service.PrintOrderService;
import com.altarwed.domain.port.CoupleRepository;
import com.altarwed.infrastructure.observability.LogSanitizer;
import com.altarwed.web.mapper.PrintOrderMapper;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/print-orders")
public class PrintOrderController {

    private static final Logger log = LoggerFactory.getLogger(PrintOrderController.class);

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
            @AuthenticationPrincipal String email
    ) {
        assertOwns(coupleId, email);
        return ResponseEntity.ok(PrintOrderMapper.toResponse(printOrderService.createOrder(coupleId, req)));
    }

    @GetMapping("/couple/{coupleId}")
    public ResponseEntity<List<PrintOrderResponse>> list(
            @PathVariable UUID coupleId,
            @AuthenticationPrincipal String email
    ) {
        assertOwns(coupleId, email);
        return ResponseEntity.ok(
                printOrderService.listOrders(coupleId).stream().map(PrintOrderMapper::toResponse).toList()
        );
    }

    /**
     * IDOR guard: the JWT principal's email must resolve to the same Couple as the
     * path coupleId. Without this, any authenticated couple could mail postcards
     * on another couple's behalf (and rack up real Lob charges on their account).
     *
     * The principal is the email String set by JwtAuthenticationFilter, NOT a
     * UserDetails. Binding it as @AuthenticationPrincipal UserDetails yields null
     * and makes this guard reject every request, the print feature 500s for all.
     */
    private void assertOwns(UUID coupleId, String email) {
        // WARN on every rejection: these are the security-audit trail for IDOR
        // attempts (CLAUDE.md observability rule 6). Email is masked per rule 8.
        if (email == null) {
            log.warn("print order access denied, reason=unauthenticated, coupleId={}", coupleId);
            throw new AccessDeniedException("Unauthenticated");
        }
        UUID authenticatedCoupleId = coupleRepository.findByEmail(email)
                .map(c -> c.id())
                .orElseThrow(() -> {
                    log.warn("print order access denied, reason=unknown principal, actor={}", LogSanitizer.maskEmail(email));
                    return new AccessDeniedException("Unknown principal");
                });
        if (!authenticatedCoupleId.equals(coupleId)) {
            log.warn("print order access denied, reason=idor attempt, actor={}, targetCoupleId={}",
                     LogSanitizer.maskEmail(email), coupleId);
            throw new AccessDeniedException("Cannot access another couple's print orders");
        }
    }
}
