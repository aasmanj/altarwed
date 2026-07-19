-- V97: Index for family-wide revocation (issue #250). Separate migration from
-- the V96 column add, per the SQL Server parse-time rule in backend/CLAUDE.md.
-- deleteAllByFamilyId must not table-scan refresh_tokens when the reuse
-- tripwire fires.
CREATE NONCLUSTERED INDEX ix_refresh_tokens_family_id ON refresh_tokens (family_id);
