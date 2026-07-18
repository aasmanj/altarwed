package com.altarwed.domain.exception;

public class PortfolioCapExceededException extends RuntimeException {
    // Issue #370: the cap is tier-dependent (10 for Basic/Pro, 25 for Premium), so the message
    // names the caller's actual cap instead of a hardcoded 10.
    public PortfolioCapExceededException(int cap) {
        super("Portfolio is full. Delete a photo to add another (max " + cap + ").");
    }
}
