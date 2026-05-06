CREATE TABLE wedding_photos (
    id               UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
    wedding_website_id UNIQUEIDENTIFIER NOT NULL,
    url              NVARCHAR(500)    NOT NULL,
    caption          NVARCHAR(300)    NULL,
    sort_order       INT              NOT NULL DEFAULT 0,
    created_at       DATETIME2        NOT NULL DEFAULT SYSDATETIME(),

    CONSTRAINT fk_wedding_photos_website
        FOREIGN KEY (wedding_website_id) REFERENCES wedding_websites(id) ON DELETE CASCADE
);

CREATE INDEX idx_wedding_photos_website ON wedding_photos(wedding_website_id);
