package com.altarwed.domain.exception;

// Thrown when an upload that reaches the service layer exceeds the size limit. Distinct from a
// plain IllegalArgumentException (a 400) because an oversize file is a 413 Payload Too Large:
// the request was well formed and authorized, the body is simply too big. Keeping it a domain
// type (no Spring import) lets the web layer map it to 413 without string-matching a message.
public class FileTooLargeException extends RuntimeException {
    public FileTooLargeException(String message) {
        super(message);
    }
}
