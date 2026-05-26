-- V34: Per-couple tab visibility + custom labels.
--
-- Couples can now hide entire tabs from the public wedding page (e.g. a couple
-- without a registry hides REGISTRY) and rename labels (e.g. "Travel" → "Hotels
-- & flights"). Both columns are nullable; null/empty means "use defaults".
--
-- hidden_tabs        : CSV of BlockTab enum values, e.g. "REGISTRY,TRAVEL"
--                      Parsed in Java; never queried in SQL. NVARCHAR(500) is
--                      enough for all 8 enum values plus commas.
--
-- custom_tab_labels  : JSON map of BlockTab → user-chosen label, e.g.
--                      {"TRAVEL":"Hotels & flights","WEDDING_PARTY":"Our crew"}
--                      Opaque to SQL; serialized/deserialized in the mapper.
--                      NVARCHAR(MAX) since labels can include emoji and any length.

ALTER TABLE wedding_websites
    ADD hidden_tabs        NVARCHAR(500) NULL,
        custom_tab_labels  NVARCHAR(MAX) NULL;
