package com.altarwed.application.dto;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

/**
 * Regression tests for issue #28: request DTOs must use boxed Boolean so Jackson can
 * represent "not provided" / explicit null instead of throwing MismatchedInputException
 * on a primitive field. Uses ObjectMapper directly so no Spring context is required.
 *
 * Before the fix these fields were primitive boolean; deserializing an explicit JSON null
 * threw MismatchedInputException (surfacing as a 500), so each readValue below would have
 * failed the test.
 */
class BoxedBooleanDeserializationTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void createGuestRequestDeserializesExplicitNullPlusOneAllowed() throws Exception {
        CreateGuestRequest req = mapper.readValue(
                "{\"name\":\"Guest\",\"plusOneAllowed\":null}", CreateGuestRequest.class);

        assertThat(req.plusOneAllowed()).isNull();
    }

    @Test
    void createGuestRequestDeserializesOmittedPlusOneAllowed() throws Exception {
        CreateGuestRequest req = mapper.readValue(
                "{\"name\":\"Guest\"}", CreateGuestRequest.class);

        assertThat(req.plusOneAllowed()).isNull();
    }

    @Test
    void createBudgetItemRequestDeserializesExplicitNullIsPaid() throws Exception {
        CreateBudgetItemRequest req = mapper.readValue(
                "{\"vendorName\":\"Florist\",\"isPaid\":null}", CreateBudgetItemRequest.class);

        assertThat(req.isPaid()).isNull();
    }

    @Test
    void createBudgetItemRequestDeserializesOmittedIsPaid() throws Exception {
        CreateBudgetItemRequest req = mapper.readValue(
                "{\"vendorName\":\"Florist\"}", CreateBudgetItemRequest.class);

        assertThat(req.isPaid()).isNull();
    }

    @Test
    void registerVendorRequestDeserializesExplicitNullIsChristianOwned() throws Exception {
        RegisterVendorRequest req = mapper.readValue(
                "{\"businessName\":\"Chapel Flowers\",\"isChristianOwned\":null}", RegisterVendorRequest.class);

        assertThat(req.isChristianOwned()).isNull();
    }

    @Test
    void registerVendorRequestDeserializesOmittedIsChristianOwned() throws Exception {
        RegisterVendorRequest req = mapper.readValue(
                "{\"businessName\":\"Chapel Flowers\"}", RegisterVendorRequest.class);

        assertThat(req.isChristianOwned()).isNull();
    }
}
