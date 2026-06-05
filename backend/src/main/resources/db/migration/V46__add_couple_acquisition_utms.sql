-- Marketing attribution captured once, at couple registration. All columns are
-- nullable: existing couples and any signup without UTM params store NULL. Read
-- only by the founder /admin/metrics acquisition breakdown; never user-facing.
--
-- One ALTER TABLE ... ADD adds all seven columns. No constraint references a new
-- column, so the SQL Server "inline constraint" rule (see root CLAUDE.md) does
-- not apply here.
ALTER TABLE couples ADD
    utm_source    NVARCHAR(255) NULL,
    utm_medium    NVARCHAR(255) NULL,
    utm_campaign  NVARCHAR(255) NULL,
    utm_term      NVARCHAR(255) NULL,
    utm_content   NVARCHAR(255) NULL,
    referrer      NVARCHAR(255) NULL,
    landing_path  NVARCHAR(255) NULL;
