-- V33: Allow STORY_ENTRY block type.
--
-- The STORY_ENTRY block type was added to the Java BlockType enum and the
-- frontend block picker, but the V26 CHECK constraint was never updated.
-- Every attempt to insert a STORY_ENTRY block was rejected by SQL Server
-- and surfaced as a 409 "Data Conflict" (DataIntegrityViolationException
-- maps to that — misleadingly — for any constraint violation, not just
-- unique-key conflicts).
--
-- SQL Server does not support ALTER CONSTRAINT; we drop and re-add.

ALTER TABLE wedding_page_blocks DROP CONSTRAINT chk_wedding_page_blocks_type;

ALTER TABLE wedding_page_blocks ADD CONSTRAINT chk_wedding_page_blocks_type CHECK (block_type IN (
    'TEXT', 'HEADING', 'IMAGE', 'SCRIPTURE', 'DIVIDER',
    'VENUE_CARD', 'HOTEL_CARD', 'REGISTRY_CARD',
    'COUNTDOWN', 'RSVP_CTA',
    'WEDDING_PARTY_GRID', 'PHOTO_ALBUM_GRID', 'VOWS_PREVIEW',
    'STORY_ENTRY'
));
