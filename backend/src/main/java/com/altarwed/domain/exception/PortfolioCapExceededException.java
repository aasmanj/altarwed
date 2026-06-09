package com.altarwed.domain.exception;

public class PortfolioCapExceededException extends RuntimeException {
    public PortfolioCapExceededException() {
        super("Portfolio is full. Delete a photo to add another (max 10).");
    }
}
