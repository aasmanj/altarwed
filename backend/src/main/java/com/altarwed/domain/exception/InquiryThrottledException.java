package com.altarwed.domain.exception;

/**
 * Thrown when a vendor's rolling inbound inquiry budget is exhausted (issue #100).
 * Surfaced as HTTP 429 by the GlobalExceptionHandler with the same problem type as
 * the per-IP rate limit, so clients treat both throttles uniformly. The message is
 * deliberately generic and vendor-neutral: it must not reveal the cap size or window,
 * which would tell an abuser exactly how much headroom remains.
 */
public class InquiryThrottledException extends RuntimeException {
    public InquiryThrottledException() {
        super("This vendor is receiving a high volume of inquiries right now. Please try again later.");
    }
}
