-- V57: Add hero focal point, tagline color, and scripture translation to wedding_websites.
-- hero_focal_point_x / _y: 0.0-1.0 range used as CSS object-position (e.g. 0.5 / 0.5 = center).
-- hero_tagline_color: CSS color string (e.g. "#ffffff"). NULL = use default white.
-- scripture_translation: short code (e.g. "ESV", "NIV"). NULL = unset.

ALTER TABLE wedding_websites ADD hero_focal_point_x FLOAT NULL;
ALTER TABLE wedding_websites ADD hero_focal_point_y FLOAT NULL;
ALTER TABLE wedding_websites ADD hero_tagline_color NVARCHAR(20) NULL;
ALTER TABLE wedding_websites ADD scripture_translation NVARCHAR(20) NULL;
