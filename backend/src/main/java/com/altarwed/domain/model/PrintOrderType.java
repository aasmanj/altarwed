package com.altarwed.domain.model;

public enum PrintOrderType {
    SAVE_THE_DATE,
    INVITATION,
    // Issue #208: a single self-addressed proof postcard the couple mails to themselves (paid,
    // same Stripe path as a normal order) before committing to the full guest batch.
    TEST_PROOF
}
