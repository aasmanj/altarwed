-- V59: Add accent color to wedding_websites.
-- CSS color string (e.g. "#d4af6a"). NULL = use the default AltarWed gold.

ALTER TABLE wedding_websites ADD accent_color NVARCHAR(20) NULL;
