-- V6: Vendor subscription tracking (Stripe-backed)
-- Tracks which plan tier a vendor is on and their billing status.
-- stripe_customer_id and stripe_subscription_id are set after Stripe checkout completes.

CREATE TABLE vendor_subscriptions (
    id                      UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWSEQUENTIALID(),
    vendor_id               UNIQUEIDENTIFIER    NOT NULL,
    plan_tier               NVARCHAR(20)        NOT NULL,
    status                  NVARCHAR(20)        NOT NULL DEFAULT 'PENDING',
    stripe_customer_id      NVARCHAR(100)       NULL,
    stripe_subscription_id  NVARCHAR(100)       NULL,
    current_period_start    DATETIME2           NULL,
    current_period_end      DATETIME2           NULL,
    cancelled_at            DATETIME2           NULL,
    created_at              DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at              DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT pk_vendor_subscriptions PRIMARY KEY (id),
    CONSTRAINT fk_vendor_subscriptions_vendor FOREIGN KEY (vendor_id)
        REFERENCES vendors (id) ON DELETE CASCADE,
    CONSTRAINT uq_vendor_subscriptions_vendor UNIQUE (vendor_id),
    CONSTRAINT chk_vendor_subscriptions_plan CHECK (plan_tier IN ('BASIC', 'FEATURED', 'PREMIUM')),
    CONSTRAINT chk_vendor_subscriptions_status CHECK (status IN (
        'PENDING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'TRIALING'
    ))
);

CREATE INDEX ix_vendor_subscriptions_vendor_id         ON vendor_subscriptions (vendor_id);
CREATE INDEX ix_vendor_subscriptions_status            ON vendor_subscriptions (status);
CREATE INDEX ix_vendor_subscriptions_stripe_customer   ON vendor_subscriptions (stripe_customer_id);
CREATE INDEX ix_vendor_subscriptions_period_end        ON vendor_subscriptions (current_period_end);
