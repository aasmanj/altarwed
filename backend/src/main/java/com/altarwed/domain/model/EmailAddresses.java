package com.altarwed.domain.model;

/**
 * Conservative syntactic check for email addresses, shared by the guest service
 * (to tell the couple which addresses to fix before sending) and the Resend adapter
 * (to keep malformed addresses out of a batch, where one bad address 422s all 100).
 *
 * This is intentionally NOT a full RFC 5322 validator: it rejects the real-world
 * breakers we have actually seen (blank, no @, a double @ like "j@22@gmail.com",
 * embedded whitespace, a domain with no dot) and lets the provider be the final
 * authority on everything subtler. Pure domain code: zero framework imports.
 */
public final class EmailAddresses {

    private EmailAddresses() {}

    public static boolean isValid(String email) {
        if (email == null) return false;
        String trimmed = email.trim();
        if (trimmed.isEmpty() || trimmed.chars().anyMatch(Character::isWhitespace)) return false;
        int at = trimmed.indexOf('@');
        if (at <= 0) return false;                            // missing @ or empty local part
        if (trimmed.indexOf('@', at + 1) != -1) return false; // more than one @
        String domain = trimmed.substring(at + 1);
        int dot = domain.indexOf('.');
        return dot > 0 && dot < domain.length() - 1;          // domain has a dot, not at either edge
    }
}
