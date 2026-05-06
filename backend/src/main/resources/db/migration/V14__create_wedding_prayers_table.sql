CREATE TABLE wedding_prayers (
    id                  UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
    wedding_website_id  UNIQUEIDENTIFIER  NOT NULL,
    guest_name          NVARCHAR(200)     NOT NULL,
    prayer_text         NVARCHAR(MAX)     NOT NULL,
    created_at          DATETIME2         NOT NULL,

    CONSTRAINT fk_wedding_prayers_website FOREIGN KEY (wedding_website_id) REFERENCES wedding_websites(id) ON DELETE CASCADE
);

CREATE INDEX idx_wedding_prayers_website_id ON wedding_prayers(wedding_website_id);
