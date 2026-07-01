-- Additive index for the public vendor directory's default (most-viewed) sort.
--
-- Issue #135 pushes the directory's filter, sort, and paging into SQL. The hot,
-- unfiltered path (the default directory view and the SEO crawler hitting page 0)
-- now runs:
--   WHERE is_active = 1 AND is_verified = 1
--   ORDER BY view_count DESC, business_name ASC, id ASC
--   OFFSET ... FETCH ...
-- Without a matching index SQL Server seeks the low-selectivity is_active flag (or
-- scans) and then sorts the whole active+verified set on every request. This index
-- keys on the two equality predicates first, then view_count DESC and the
-- business_name/id tiebreak in ORDER BY order, so the optimizer can satisfy the
-- ORDER BY from the index and serve the top-N page as a seek with no sort operator.
--
-- Filtered queries (category/city) still use ix_vendors_category / ix_vendors_city
-- and sort their smaller result set; this index targets the unfiltered default path.
--
-- Additive only: no drops, no backfill, no type change. Hibernate ddl-auto=validate
-- ignores indexes, so this does not affect entity validation.

CREATE INDEX ix_vendors_directory_default
    ON vendors (is_active, is_verified, view_count DESC, business_name, id);
