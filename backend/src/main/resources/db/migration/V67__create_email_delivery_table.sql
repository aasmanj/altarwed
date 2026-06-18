-- V67: per-email delivery log, written by the Resend webhook (email.delivered,
-- email.bounced, email.complained, email.delivery_delayed). Lets the dashboard
-- show couples which save-the-dates / invites were actually delivered vs bounced,
-- rather than only "we attempted to send" (the optimistic save_the_date_sent_at /
-- invite_sent_at stamps). Keyed by Resend's email_id so a webhook can find its row.
--
-- recipient_email_hash is the SHA-256 of the lowercased address (same scheme as
-- email_suppression), so we never store a plaintext guest email here. guest_id and
-- couple_id come from the message tags we attach at send time; both are nullable
-- because not every tracked send is guaranteed to carry them.

CREATE TABLE email_delivery (
    id                   UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_email_delivery_id DEFAULT NEWID(),
    resend_email_id      NVARCHAR(100)    NOT NULL,
    guest_id             UNIQUEIDENTIFIER NULL,
    couple_id            UNIQUEIDENTIFIER NULL,
    email_type           NVARCHAR(40)     NOT NULL,
    recipient_email_hash NVARCHAR(64)     NULL,
    status               NVARCHAR(20)     NOT NULL,
    bounce_type          NVARCHAR(20)     NULL,
    bounce_subtype       NVARCHAR(50)     NULL,
    last_event_at        DATETIME2        NOT NULL,
    created_at           DATETIME2        NOT NULL CONSTRAINT df_email_delivery_created_at DEFAULT GETUTCDATE(),
    updated_at           DATETIME2        NOT NULL CONSTRAINT df_email_delivery_updated_at DEFAULT GETUTCDATE(),
    CONSTRAINT pk_email_delivery               PRIMARY KEY (id),
    CONSTRAINT uq_email_delivery_resend_id     UNIQUE      (resend_email_id)
);

-- Dashboard read path joins delivery rows back to a couple's guests.
CREATE INDEX ix_email_delivery_couple ON email_delivery (couple_id);
CREATE INDEX ix_email_delivery_guest  ON email_delivery (guest_id);
