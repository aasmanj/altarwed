CREATE TABLE blog_posts (
    id            UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    slug          NVARCHAR(300)    NOT NULL,
    title         NVARCHAR(300)    NOT NULL,
    excerpt       NVARCHAR(500)    NOT NULL,
    content       NVARCHAR(MAX)    NOT NULL,
    author        NVARCHAR(150)    NOT NULL,
    published_at  DATETIME2        NULL,
    seo_title     NVARCHAR(300)    NULL,
    seo_desc      NVARCHAR(160)    NULL,
    tags          NVARCHAR(500)    NULL,
    cover_image   NVARCHAR(500)    NULL,
    is_published  BIT              NOT NULL DEFAULT 0,
    created_at    DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at    DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT UQ_blog_posts_slug UNIQUE (slug)
);

CREATE INDEX IX_blog_posts_published ON blog_posts (is_published, published_at DESC);
