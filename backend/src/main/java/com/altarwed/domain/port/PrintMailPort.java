package com.altarwed.domain.port;

public interface PrintMailPort {

    /**
     * Submit one postcard for printing and first-class mailing.
     * Returns a provider-specific tracking ID (e.g. Lob postcard id).
     * Throws PrintMailException if the provider rejects the request.
     */
    String sendPostcard(PostcardRequest request);

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
                     String city, String state, String zip) {}

    class PrintMailException extends RuntimeException {
        public PrintMailException(String message) { super(message); }
        public PrintMailException(String message, Throwable cause) { super(message, cause); }
    }
}
