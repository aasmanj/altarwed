-- V8: Soft delete for wedding websites
-- Allows couples to deactivate their page without losing data.
-- is_published=false hides from public; is_deleted=true hides from everything.
-- deleted_at records when for audit purposes.

ALTER TABLE wedding_websites
    ADD is_deleted  BIT       NOT NULL DEFAULT 0,
        deleted_at  DATETIME2 NULL;

CREATE INDEX ix_wedding_websites_deleted ON wedding_websites (is_deleted);
