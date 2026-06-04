-- Migrate blog post cover images from Unsplash hotlinks to Azure Blob Storage.
-- Unsplash ToS requires downloading images, not hotlinking their CDN.
-- Images are now self-owned assets in altarwed-media/blog/.

UPDATE blog_posts
SET cover_image = 'https://altarwedprodstorage.blob.core.windows.net/altarwed-media/blog/blog-christian-wedding-ceremony-order.jpg',
    updated_at  = SYSUTCDATETIME()
WHERE slug = 'christian-wedding-ceremony-order';

UPDATE blog_posts
SET cover_image = 'https://altarwedprodstorage.blob.core.windows.net/altarwed-media/blog/blog-bible-verses-for-weddings.jpg',
    updated_at  = SYSUTCDATETIME()
WHERE slug = 'bible-verses-for-weddings';

UPDATE blog_posts
SET cover_image = 'https://altarwedprodstorage.blob.core.windows.net/altarwed-media/blog/blog-christian-wedding-vows.jpg',
    updated_at  = SYSUTCDATETIME()
WHERE slug = 'christian-wedding-vows';

UPDATE blog_posts
SET cover_image = 'https://altarwedprodstorage.blob.core.windows.net/altarwed-media/blog/blog-christian-wedding-planning-checklist.jpg',
    updated_at  = SYSUTCDATETIME()
WHERE slug = 'christian-wedding-planning-checklist';

UPDATE blog_posts
SET cover_image = 'https://altarwedprodstorage.blob.core.windows.net/altarwed-media/blog/blog-christian-wedding-songs.jpg',
    updated_at  = SYSUTCDATETIME()
WHERE slug = 'christian-wedding-songs';

UPDATE blog_posts
SET cover_image = 'https://altarwedprodstorage.blob.core.windows.net/altarwed-media/blog/blog-christian-unity-ceremony-ideas.jpg',
    updated_at  = SYSUTCDATETIME()
WHERE slug = 'christian-unity-ceremony-ideas';
