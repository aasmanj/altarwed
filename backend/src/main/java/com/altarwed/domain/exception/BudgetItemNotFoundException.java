package com.altarwed.domain.exception;

public class BudgetItemNotFoundException extends RuntimeException {
    public BudgetItemNotFoundException(String id) {
        super("Budget item not found: " + id);
    }
}
