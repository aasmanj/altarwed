package com.altarwed.domain.port;

import java.time.LocalDate;
import java.util.Optional;

public interface PrintMailPort {

    /**
     * Submit one postcard for printing and first-class mailing.
     * Returns a provider-specific tracking ID (e.g. Lob postcard id).
     * Throws PrintMailException if the provider rejects the request.
     */
    String sendPostcard(PostcardRequest request);

    /**
     * Look up the current delivery status (plus tracking number and expected delivery date, when
     * the provider has them, issue #59) of a previously-submitted postcard by its provider id.
     * Returns empty when the provider has no status yet or the lookup fails. Never throws: a
     * status refresh is best-effort and must not fail the caller's request.
     */
    Optional<PostcardStatusResult> fetchPostcardStatus(String providerPostcardId);

    /**
     * Issue #59: verify a US mailing address is CASS-certified deliverable BEFORE charging the
     * couple for it, rather than relying solely on Lob rejecting it at postcard-creation time
     * (after the charge). US-domestic only -- callers must not call this for international
     * addresses, Lob has no equivalent product for those. Never throws: an unexpected provider
     * failure should not block the couple's whole order, so a failed/unreachable verification
     * call returns a result indicating "could not verify" rather than propagating.
     */
    AddressVerificationResult verifyAddress(ToAddress address);

    // Lob distinguishes test vs live entirely by API key prefix (test_ vs live_),
    // so we deliberately do not carry a mode flag on the request, there is no way
    // for a caller to override the operating mode the configured key implies.
    record PostcardRequest(
            String templateKey,
            String coupleNames,
            String weddingDate,
            String weddingUrl,
            String heroPhotoUrl,
            String venueLine,
            FromAddress from,
            ToAddress to
    ) {}

    record FromAddress(String name, String addressLine1, String addressLine2,
                       String city, String state, String zip) {}

    record ToAddress(String name, String addressLine1, String addressLine2,
                     String city, String state, String zip, String country) {}

    /** trackingNumber/expectedDeliveryDate are null until the provider has them (best-effort). */
    record PostcardStatusResult(String deliveryStatus, String trackingNumber, LocalDate expectedDeliveryDate) {}

    /**
     * deliverable=true covers Lob's deliverable, deliverable_unnecessary_unit,
     * deliverable_incorrect_unit, and deliverable_missing_unit classifications -- all are
     * genuinely USPS-deliverable, just with a minor unit/suite discrepancy. Only Lob's
     * "undeliverable" classification (or a failed/unreachable verification call) sets this false.
     * reason is a couple-facing message, populated only when deliverable=false.
     */
    record AddressVerificationResult(boolean deliverable, String reason) {}

    class PrintMailException extends RuntimeException {
        // Couple-facing detail (e.g. the provider's rejection reason). Kept OFF the exception
        // message on purpose: the message and cause chain get logged to App Insights, and a
        // provider error string can echo submitted address fields. This detail is surfaced only
        // to the couple via the per-recipient error row, never logged. Null when there is none.
        private final String userDetail;

        public PrintMailException(String message) { super(message); this.userDetail = null; }
        public PrintMailException(String message, Throwable cause) { super(message, cause); this.userDetail = null; }
        public PrintMailException(String message, String userDetail, Throwable cause) {
            super(message, cause);
            this.userDetail = userDetail;
        }

        public String userDetail() { return userDetail; }
    }
}
