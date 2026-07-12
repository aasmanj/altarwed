-- V91: allowlisted font KEY for the couple's names on the public wedding hero
-- (e.g. "playfair", "cormorant", "greatvibes", "montserrat", "lora"). null = the
-- default serif (Playfair). Stored as a short opaque key, never a raw CSS font-family:
-- the frontend maps the key to a loaded next/font family via safeFont(), and the
-- UpdateWeddingWebsiteRequest @Pattern rejects any value outside the allowlist so
-- untrusted input can never reach the public <style> sink.
ALTER TABLE wedding_websites ADD name_font NVARCHAR(40) NULL;
