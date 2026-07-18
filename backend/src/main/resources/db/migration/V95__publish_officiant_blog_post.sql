-- Publish "How to Choose a Christian Wedding Officiant" (seeded as a draft in V94,
-- reviewed and approved by Jordan). published_at is refreshed to the publish moment so
-- the public date reflects when readers could first see the post, not the seed date.
UPDATE blog_posts
SET is_published = 1,
    published_at = SYSUTCDATETIME(),
    updated_at   = SYSUTCDATETIME()
WHERE slug = 'how-to-choose-a-christian-wedding-officiant'
  AND is_published = 0;
