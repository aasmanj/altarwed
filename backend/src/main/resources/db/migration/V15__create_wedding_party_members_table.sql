CREATE TABLE wedding_party_members (
    id                  UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
    wedding_website_id  UNIQUEIDENTIFIER  NOT NULL,
    name                NVARCHAR(200)     NOT NULL,
    role                NVARCHAR(100)     NOT NULL,
    side                NVARCHAR(10)      NOT NULL,
    bio                 NVARCHAR(MAX)     NULL,
    photo_url           NVARCHAR(500)     NULL,
    sort_order          INT               NOT NULL DEFAULT 0,
    created_at          DATETIME2         NOT NULL,
    updated_at          DATETIME2         NOT NULL,

    CONSTRAINT fk_wedding_party_website FOREIGN KEY (wedding_website_id) REFERENCES wedding_websites(id) ON DELETE CASCADE
);

CREATE INDEX idx_wedding_party_website_id ON wedding_party_members(wedding_website_id);
