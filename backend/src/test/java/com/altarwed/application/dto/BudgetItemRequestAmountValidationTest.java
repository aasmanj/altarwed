package com.altarwed.application.dto;

import static org.assertj.core.api.Assertions.assertThat;

import com.altarwed.domain.model.BudgetCategory;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import java.math.BigDecimal;
import java.util.Set;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

/**
 * Regression tests for issue #231: an amount at or above 100,000,000 used to pass validation,
 * overflow DECIMAL(10,2) at insert, and surface as a misleading 409 "already exists" plus a
 * false ERROR log. The @DecimalMax("99999999.99") cap now rejects the value at the validation
 * layer (a clean 400) before it ever reaches the database, so no DataIntegrityViolation and no
 * ERROR log are produced.
 *
 * Uses the Bean Validation API directly so no Spring context is required, matching the existing
 * DTO test style in this package.
 */
class BudgetItemRequestAmountValidationTest {

    private static ValidatorFactory factory;
    private static Validator validator;

    private static final BigDecimal OVERSIZED = new BigDecimal("100000000.00");
    private static final BigDecimal AT_CAP = new BigDecimal("99999999.99");

    @BeforeAll
    static void setUp() {
        factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @AfterAll
    static void tearDown() {
        factory.close();
    }

    @Test
    void createRejectsOversizedEstimatedCostWithFriendlyMessage() {
        CreateBudgetItemRequest req = new CreateBudgetItemRequest(
                BudgetCategory.VENUE, "Grand Hall", OVERSIZED, null, false, null);

        Set<ConstraintViolation<CreateBudgetItemRequest>> violations = validator.validate(req);

        assertThat(violations)
                .extracting(ConstraintViolation::getMessage)
                .contains("Amount is too large");
    }

    @Test
    void createRejectsOversizedActualCostWithFriendlyMessage() {
        CreateBudgetItemRequest req = new CreateBudgetItemRequest(
                BudgetCategory.VENUE, "Grand Hall", new BigDecimal("100.00"), OVERSIZED, false, null);

        Set<ConstraintViolation<CreateBudgetItemRequest>> violations = validator.validate(req);

        assertThat(violations)
                .extracting(ConstraintViolation::getMessage)
                .contains("Amount is too large");
    }

    @Test
    void createAcceptsAmountAtTheCap() {
        CreateBudgetItemRequest req = new CreateBudgetItemRequest(
                BudgetCategory.VENUE, "Grand Hall", AT_CAP, AT_CAP, false, null);

        assertThat(validator.validate(req)).isEmpty();
    }

    @Test
    void updateRejectsOversizedEstimatedCostWithFriendlyMessage() {
        UpdateBudgetItemRequest req = new UpdateBudgetItemRequest(
                BudgetCategory.VENUE, "Grand Hall", OVERSIZED, null, false, null);

        Set<ConstraintViolation<UpdateBudgetItemRequest>> violations = validator.validate(req);

        assertThat(violations)
                .extracting(ConstraintViolation::getMessage)
                .contains("Amount is too large");
    }

    @Test
    void updateRejectsOversizedActualCostWithFriendlyMessage() {
        UpdateBudgetItemRequest req = new UpdateBudgetItemRequest(
                BudgetCategory.VENUE, "Grand Hall", new BigDecimal("100.00"), OVERSIZED, false, null);

        Set<ConstraintViolation<UpdateBudgetItemRequest>> violations = validator.validate(req);

        assertThat(violations)
                .extracting(ConstraintViolation::getMessage)
                .contains("Amount is too large");
    }

    @Test
    void updateAcceptsAmountAtTheCap() {
        UpdateBudgetItemRequest req = new UpdateBudgetItemRequest(
                BudgetCategory.VENUE, "Grand Hall", AT_CAP, AT_CAP, false, null);

        assertThat(validator.validate(req)).isEmpty();
    }
}
