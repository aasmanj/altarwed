-- V26: Wedding page blocks — typed, ordered content per tab.
-- Phase 1 of the side-by-side editor: each tab on the public wedding page is rendered
-- from a list of blocks instead of fixed sections. Couples can add/edit/reorder blocks.
--
-- content_json is opaque to SQL Server — interpreted per block_type by the application
-- (TextBlockContent, ImageBlockContent, ScriptureBlockContent, etc).
-- Trade-off vs per-type columns: keeps schema stable as block types proliferate.
-- Queries are always (websiteId, tab) → ordered list, so the composite index covers them.

CREATE TABLE wedding_page_blocks (
    id                   UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWSEQUENTIALID(),
    wedding_website_id   UNIQUEIDENTIFIER  NOT NULL,
    tab                  NVARCHAR(32)      NOT NULL,
    block_type           NVARCHAR(32)      NOT NULL,
    sort_order           INT               NOT NULL,
    content_json         NVARCHAR(MAX)     NOT NULL,
    created_at           DATETIME2         NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at           DATETIME2         NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT pk_wedding_page_blocks PRIMARY KEY (id),
    CONSTRAINT fk_wedding_page_blocks_website FOREIGN KEY (wedding_website_id)
        REFERENCES wedding_websites(id) ON DELETE CASCADE,
    CONSTRAINT chk_wedding_page_blocks_tab CHECK (tab IN (
        'HOME', 'OUR_STORY', 'DETAILS', 'WEDDING_PARTY',
        'REGISTRY', 'TRAVEL', 'PHOTOS', 'RSVP'
    )),
    CONSTRAINT chk_wedding_page_blocks_type CHECK (block_type IN (
        'TEXT', 'HEADING', 'IMAGE', 'SCRIPTURE', 'DIVIDER',
        'VENUE_CARD', 'HOTEL_CARD', 'REGISTRY_CARD',
        'COUNTDOWN', 'RSVP_CTA',
        'WEDDING_PARTY_GRID', 'PHOTO_ALBUM_GRID', 'VOWS_PREVIEW'
    ))
);

CREATE INDEX ix_wedding_page_blocks_website_tab
    ON wedding_page_blocks (wedding_website_id, tab, sort_order);
