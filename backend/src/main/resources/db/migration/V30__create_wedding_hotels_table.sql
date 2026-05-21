-- Replaces the single-hotel scalar fields on wedding_websites with a normalized table.
-- The old hotel_name / hotel_url / hotel_details columns are retained for data safety;
-- new UI writes to this table. The public page prefers this table when rows exist.
CREATE TABLE wedding_hotels (
    id                  UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    website_id          UNIQUEIDENTIFIER NOT NULL,
    name                NVARCHAR(200)    NOT NULL,
    address             NVARCHAR(500)    NULL,
    booking_url         NVARCHAR(1000)   NULL,
    -- Free-text block rate, e.g. "$149/night — mention AltarWed when booking"
    block_rate          NVARCHAR(300)    NULL,
    -- Driving distance from the venue. Populated automatically when GOOGLE_MAPS_API_KEY
    -- is configured; otherwise entered manually by the couple.
    distance_from_venue NVARCHAR(100)    NULL,
    sort_order          INT              NOT NULL DEFAULT 0,
    created_at          DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at          DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT fk_wedding_hotels_website
        FOREIGN KEY (website_id) REFERENCES wedding_websites(id) ON DELETE CASCADE
);

CREATE INDEX IX_wedding_hotels_website_id ON wedding_hotels (website_id, sort_order);
