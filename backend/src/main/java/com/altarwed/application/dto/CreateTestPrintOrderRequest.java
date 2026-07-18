package com.altarwed.application.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Issue #208: create a single self-addressed test postcard (a proof of the real printed card)
 * for the couple, mailed to their own return address. Deliberately a separate request from
 * CreatePrintOrderRequest: a test order has no guest recipients, and keeping the shapes apart
 * means the batch DTO keeps its strict @NotEmpty guestIds validation untouched.
 *
 * No orderType field: the endpoint itself implies TEST_PROOF. templateKey still carries the
 * full card design (e.g. SAVE_THE_DATE_PHOTO plus overlay suffix), so the proof renders exactly
 * what the real batch would.
 */
public record CreateTestPrintOrderRequest(
        @NotBlank String templateKey,
        // The couple's own mailing address: printed as the return address AND used as the single
        // recipient address (that is the point of a self-addressed proof).
        @NotBlank String returnName,
        @NotBlank String returnAddressLine1,
        String returnAddressLine2,
        @NotBlank String returnCity,
        // 2-letter USPS state code: fail fast at validation rather than burning an external
        // Lob verifyAddress call on an obviously malformed state.
        @NotBlank @Size(min = 2, max = 2) String returnState,
        @NotBlank String returnZip,
        // Client-generated dedup token (UUID). Optional for backward compatibility, but the web
        // client always sends one; a repeat submit with the same key returns the original order.
        String idempotencyKey,
        // Printed-card shape/size: LANDSCAPE_6X11 (default), PORTRAIT_6X9, or PORTRAIT_5X7.
        String cardSize
) {}
