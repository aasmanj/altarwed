-- Expand mail_state from NCHAR(2) to support international provinces/regions (e.g. "Ontario"),
-- and add mail_country for routing international Lob postcards (Canada, Mexico, Italy, etc.).
ALTER TABLE guests ALTER COLUMN mail_state NVARCHAR(100) NULL;
ALTER TABLE guests ADD mail_country NVARCHAR(100) NULL;
