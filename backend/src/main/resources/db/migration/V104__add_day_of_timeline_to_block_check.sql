-- V104: Allow the DAY_OF_TIMELINE block type.
--
-- DAY_OF_TIMELINE is a new page-builder block that renders the couple's
-- wedding-day schedule (time + event title + optional notes) on the public
-- wedding website. The V26 CHECK constraint (last widened by V39 for
-- STORY_ENTRY) does not know about it, so every insert would be rejected by
-- SQL Server and surface to the couple as a 409 "Data Conflict"
-- (DataIntegrityViolationException maps to that for any constraint violation,
-- not just unique-key conflicts).
--
-- SQL Server does not support ALTER CONSTRAINT; we drop and re-add. This is
-- additive only: the value list is V39's list plus DAY_OF_TIMELINE, so no
-- existing row can be invalidated by the re-add.

ALTER TABLE wedding_page_blocks DROP CONSTRAINT chk_wedding_page_blocks_type;

ALTER TABLE wedding_page_blocks ADD CONSTRAINT chk_wedding_page_blocks_type CHECK (block_type IN (
    'TEXT', 'HEADING', 'IMAGE', 'SCRIPTURE', 'DIVIDER',
    'VENUE_CARD', 'HOTEL_CARD', 'REGISTRY_CARD',
    'COUNTDOWN', 'RSVP_CTA',
    'WEDDING_PARTY_GRID', 'PHOTO_ALBUM_GRID', 'VOWS_PREVIEW',
    'STORY_ENTRY',
    'DAY_OF_TIMELINE'
));
