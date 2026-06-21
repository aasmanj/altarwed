-- V70: Non-destructive crop/recenter for wedding-party avatars and album photos.
-- Mirrors the V57 hero focal-point design: we keep the original uploaded image and
-- store HOW to frame it rather than baking a cropped file, so a couple can re-crop
-- any time without re-uploading.
--   focal_point_x / _y: 0.0-1.0, used as CSS object-position (0.5 / 0.5 = centered).
--                       NULL = center (the existing behaviour for every current row).
--   zoom: scale factor >= 1.0 applied on render (CSS transform: scale). NULL = 1.0
--         (no zoom). Lets the couple zoom in to crop tighter than the frame.
-- FLOAT NULL matches the hero columns (wedding_websites.hero_focal_point_x/_y) so the
-- frontend can treat all three image surfaces identically.

ALTER TABLE wedding_party_members ADD focal_point_x FLOAT NULL;
ALTER TABLE wedding_party_members ADD focal_point_y FLOAT NULL;
ALTER TABLE wedding_party_members ADD zoom FLOAT NULL;

ALTER TABLE wedding_photos ADD focal_point_x FLOAT NULL;
ALTER TABLE wedding_photos ADD focal_point_y FLOAT NULL;
ALTER TABLE wedding_photos ADD zoom FLOAT NULL;
