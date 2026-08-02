-- Backfill pre-CDN media URLs onto the Front Door host (issue #375).
--
-- AzureBlobStorageAdapter rewrites the storage host to BLOB_PUBLIC_BASE_URL
-- (https://media.altarwed.com) at UPLOAD time only, so rows written before that
-- setting existed still hold raw altarwedprodstorage.blob.core.windows.net URLs
-- and their guest traffic bypasses the CDN entirely (full origin egress on every
-- view). Host-for-host swap: the Front Door route maps
-- media.altarwed.com/{container}/{blob} to the identical path on the storage
-- origin, so paths are preserved verbatim.
--
-- Idempotent by predicate: each WHERE matches only rows still on the storage
-- host, so a re-run is a no-op. New uploads are already rewritten by the adapter.
DECLARE @storageOrigin NVARCHAR(100) = 'https://altarwedprodstorage.blob.core.windows.net/';
DECLARE @cdnOrigin NVARCHAR(100) = 'https://media.altarwed.com/';

UPDATE wedding_websites
SET hero_photo_url = REPLACE(hero_photo_url, @storageOrigin, @cdnOrigin)
WHERE hero_photo_url LIKE @storageOrigin + '%';

UPDATE wedding_party_members
SET photo_url = REPLACE(photo_url, @storageOrigin, @cdnOrigin)
WHERE photo_url LIKE @storageOrigin + '%';

UPDATE wedding_photos
SET url = REPLACE(url, @storageOrigin, @cdnOrigin)
WHERE url LIKE @storageOrigin + '%';

UPDATE vendors
SET logo_url = REPLACE(logo_url, @storageOrigin, @cdnOrigin)
WHERE logo_url LIKE @storageOrigin + '%';

UPDATE blog_posts
SET cover_image = REPLACE(cover_image, @storageOrigin, @cdnOrigin)
WHERE cover_image LIKE @storageOrigin + '%';

-- Page-builder blocks embed image URLs inside their JSON payload (photo and hero
-- blocks), so the swap applies inside the document, not just on scalar columns.
UPDATE wedding_page_blocks
SET content_json = REPLACE(content_json, @storageOrigin, @cdnOrigin)
WHERE content_json LIKE '%' + @storageOrigin + '%';
