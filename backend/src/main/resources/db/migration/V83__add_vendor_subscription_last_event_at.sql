-- #115: track the timestamp of the last-applied Stripe webhook event per subscription, so an
-- out-of-order delivery (e.g. a delayed subscription.updated arriving after subscription.deleted)
-- can be detected and dropped instead of silently re-activating a cancelled vendor.
ALTER TABLE vendor_subscriptions ADD last_stripe_event_at DATETIME2 NULL;
