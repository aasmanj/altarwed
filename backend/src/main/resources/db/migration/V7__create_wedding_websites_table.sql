-- V7: Wedding website — one per couple, publicly shareable at /wedding/[slug]
-- slug is URL-safe, lowercase-hyphenated, chosen by the couple (e.g. jordan-and-eden-faith)

CREATE TABLE wedding_websites (
    id                      UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWSEQUENTIALID(),
    couple_id               UNIQUEIDENTIFIER    NOT NULL,
    slug                    NVARCHAR(100)       NOT NULL,
    is_published            BIT                 NOT NULL DEFAULT 0,

    -- Display names (may differ from account names — couples can customize)
    partner_one_name        NVARCHAR(100)       NOT NULL,
    partner_two_name        NVARCHAR(100)       NOT NULL,
    wedding_date            DATE                NULL,

    -- Content sections
    hero_photo_url          NVARCHAR(500)       NULL,
    our_story               NVARCHAR(MAX)       NULL,
    testimony               NVARCHAR(MAX)       NULL,
    covenant_statement      NVARCHAR(MAX)       NULL,
    scripture_reference     NVARCHAR(200)       NULL,
    scripture_text          NVARCHAR(MAX)       NULL,

    -- Event details
    venue_name              NVARCHAR(200)       NULL,
    venue_address           NVARCHAR(300)       NULL,
    venue_city              NVARCHAR(100)       NULL,
    venue_state             NVARCHAR(50)        NULL,
    ceremony_time           NVARCHAR(50)        NULL,
    dress_code              NVARCHAR(100)       NULL,

    -- Hotel block
    hotel_name              NVARCHAR(200)       NULL,
    hotel_url               NVARCHAR(500)       NULL,
    hotel_details           NVARCHAR(MAX)       NULL,

    -- Registry links (up to 3)
    registry_url_1          NVARCHAR(500)       NULL,
    registry_label_1        NVARCHAR(100)       NULL,
    registry_url_2          NVARCHAR(500)       NULL,
    registry_label_2        NVARCHAR(100)       NULL,
    registry_url_3          NVARCHAR(500)       NULL,
    registry_label_3        NVARCHAR(100)       NULL,

    -- RSVP
    rsvp_deadline           DATE                NULL,

    created_at              DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at              DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT pk_wedding_websites PRIMARY KEY (id),
    CONSTRAINT fk_wedding_websites_couple FOREIGN KEY (couple_id)
        REFERENCES couples (id) ON DELETE CASCADE,
    CONSTRAINT uq_wedding_websites_couple UNIQUE (couple_id),
    CONSTRAINT uq_wedding_websites_slug   UNIQUE (slug)
);

CREATE INDEX ix_wedding_websites_slug      ON wedding_websites (slug);
CREATE INDEX ix_wedding_websites_couple_id ON wedding_websites (couple_id);
CREATE INDEX ix_wedding_websites_published ON wedding_websites (is_published);
