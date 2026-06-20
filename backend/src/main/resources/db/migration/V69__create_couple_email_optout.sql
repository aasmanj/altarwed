-- Per-couple (per-wedding) voluntary email opt-outs, the model The Knot/Zola use: a
-- guest who unsubscribes from one couple's wedding mail must still receive a different
-- couple's. This is distinct from email_suppression (V47), which stays GLOBAL and holds
-- only address-level deliverability facts (permanent bounces, spam complaints) that
-- protect the shared altarwed.com sending reputation for every couple.
--
-- A guest is suppressed for a send when EITHER a global email_suppression row exists for
-- the hash OR a row exists here for (this couple, this hash). Resubscribe is recipient-
-- initiated: when the guest RSVPs on the couple's site, their row here is deleted.
--
-- ON DELETE CASCADE: these opt-outs are relationship state tied to a couple, so deleting
-- the couple's account removes them (the append-only email_subscription_event keeps the
-- durable audit record). FK matches couples(id) from V1.
CREATE TABLE couple_email_optout (
    id            UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_couple_optout_id DEFAULT NEWID(),
    couple_id     UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_couple_optout_couple REFERENCES couples (id) ON DELETE CASCADE,
    email_hash    NVARCHAR(64)     NOT NULL,
    created_at    DATETIME2        NOT NULL CONSTRAINT df_couple_optout_created_at DEFAULT GETUTCDATE(),
    CONSTRAINT pk_couple_email_optout PRIMARY KEY (id),
    -- One opt-out per (couple, address); also the index that backs the per-couple
    -- existence check and the batched IN-lookup for the guest list, both of which lead
    -- with couple_id.
    CONSTRAINT uq_couple_email_optout UNIQUE (couple_id, email_hash)
);
