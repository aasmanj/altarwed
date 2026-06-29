-- Additive index for the public RSVP write path.
--
-- custom_rsvp_answers (V72) only indexes question_id (idx_custom_rsvp_answers_question)
-- and carries the unique constraint uq_custom_rsvp_answers_guest_question (question_id, guest_id).
-- A composite key leads on question_id, so it cannot serve a standalone guest_id lookup;
-- without a guest_id index SQL Server falls back to a full table scan.
--
-- Every public RSVP submit calls deleteByGuestId (CustomRsvpQuestionService.replaceAnswers)
-- and the dashboard analytics call findByGuestId, both filtering by guest_id alone. As the
-- table grows toward millions of rows that scan becomes the bottleneck on a high-write,
-- public path. This index makes those lookups a seek.
--
-- Additive only: no drops, no backfill, no type change.

CREATE INDEX idx_custom_rsvp_answers_guest ON custom_rsvp_answers(guest_id);
