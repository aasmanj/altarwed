-- V77: Replace Unsplash CDN URLs in hero_photo_url with self-hosted Azure Blob equivalents.
-- The 6 photos were uploaded to altarwed-media/defaults/hero/ in June 2026.
-- After this migration runs, images.unsplash.com can be removed from next.config.ts remotePatterns.
--
-- Photos that map directly to a blob file (appeared in the side-by-side editor):
--   photo-1519741497674  -> altar-couple.jpg
--   photo-1511285560929  -> church-arch.jpg
--   photo-1465495976277  -> garden-vows.jpg  (covers both b4c6 wizard and e4a6 editor variants)
--   photo-1606216794074  -> sunset-walk.jpg
--   photo-1537633552985  -> ring-exchange.jpg
--   photo-1550005809    -> chapel-door.jpg
--
-- Photos that were wizard-only (not in the new unified set) map to the nearest equivalent:
--   photo-1606800052052  -> ring-exchange.jpg
--   photo-1519225421980  -> sunset-walk.jpg
--   photo-1583939003579  -> church-arch.jpg
--   photo-1511795409834  -> altar-couple.jpg

DECLARE @blob NVARCHAR(200) = 'https://altarwedprodstorage.blob.core.windows.net/altarwed-media/defaults/hero';

UPDATE wedding_websites SET hero_photo_url = @blob + '/altar-couple.jpg'
WHERE hero_photo_url LIKE '%photo-1519741497674%';

UPDATE wedding_websites SET hero_photo_url = @blob + '/church-arch.jpg'
WHERE hero_photo_url LIKE '%photo-1511285560929%';

UPDATE wedding_websites SET hero_photo_url = @blob + '/garden-vows.jpg'
WHERE hero_photo_url LIKE '%photo-1465495976277%';

UPDATE wedding_websites SET hero_photo_url = @blob + '/sunset-walk.jpg'
WHERE hero_photo_url LIKE '%photo-1606216794074%';

UPDATE wedding_websites SET hero_photo_url = @blob + '/ring-exchange.jpg'
WHERE hero_photo_url LIKE '%photo-1537633552985%';

UPDATE wedding_websites SET hero_photo_url = @blob + '/chapel-door.jpg'
WHERE hero_photo_url LIKE '%photo-1550005809%';

-- Wizard-only photos (dropped from unified set)
UPDATE wedding_websites SET hero_photo_url = @blob + '/ring-exchange.jpg'
WHERE hero_photo_url LIKE '%photo-1606800052052%';

UPDATE wedding_websites SET hero_photo_url = @blob + '/sunset-walk.jpg'
WHERE hero_photo_url LIKE '%photo-1519225421980%';

UPDATE wedding_websites SET hero_photo_url = @blob + '/church-arch.jpg'
WHERE hero_photo_url LIKE '%photo-1583939003579%';

UPDATE wedding_websites SET hero_photo_url = @blob + '/altar-couple.jpg'
WHERE hero_photo_url LIKE '%photo-1511795409834%';
