package com.altarwed.domain.exception;

public class PlanningTaskNotFoundException extends RuntimeException {
    public PlanningTaskNotFoundException(String id) {
        super("Planning task not found: " + id);
    }
}
