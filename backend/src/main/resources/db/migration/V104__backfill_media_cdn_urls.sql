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
--
-- ROLLBACK (documented per the 2026-08-03 review; there is no automatic down path):
-- the swap is host-for-host, so the reverse is these same statements with
-- @storageOrigin and @cdnOrigin swapped, shipped as a NEW forward migration
-- (never by editing this file; applied migrations are immutable). After
-- reverting, also swap BLOB_PUBLIC_BASE_URL back and redeploy frontend-public
-- so ISR-cached HTML stops referencing media.altarwed.com.
--
-- ORDERING: media.altarwed.com already CNAMEs to the Front Door endpoint and
-- serves blobs today (see docs/DECISION-cdn-front-door.md), so this backfill is
-- safe to run BEFORE the Bicep caching apply; the apply is a performance step,
-- not a correctness prerequisite. The one unsafe sequence is restoring a
-- pre-CNAME database backup and replaying migrations after tearing the domain
-- down: confirm the domain still resolves before any such replay.
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
