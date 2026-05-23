-- Adds an optional tagline shown over the hero photo on the public wedding page.
-- Defaults to NULL; the frontend falls back to "Together in covenant" when absent.
-- Couples set this via the side-by-side editor's hero section.
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'wedding_websites' AND COLUMN_NAME = 'hero_tagline'
)
BEGIN
    ALTER TABLE wedding_websites
        ADD hero_tagline NVARCHAR(200) NULL;
END
