-- Custom RSVP questions: couple-defined questions shown on the public RSVP form and
-- answered once per submission by the responding guest. Answers are surfaced back in the
-- couple's dashboard guest analytics. question_type is one of:
--   TEXT   - free text answer
--   YES_NO - yes / no answer
--   CHOICE - single select from `options` (newline-delimited values)
--
-- Cascade design (avoids SQL Server's multiple-cascade-paths error 1785):
--   custom_rsvp_questions.couple_id -> couples         ON DELETE CASCADE
--   custom_rsvp_answers.guest_id    -> guests          ON DELETE CASCADE  (only cascade INTO answers)
--   custom_rsvp_answers.question_id -> questions        NO ACTION (service deletes answers first)
-- Deleting a couple cascades couples->guests->answers, removing every answer before the
-- couple's questions are dropped, so the NO ACTION question FK is never left with orphans.

CREATE TABLE custom_rsvp_questions (
    id            UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
    couple_id     UNIQUEIDENTIFIER NOT NULL,
    question_text NVARCHAR(300)    NOT NULL,
    question_type NVARCHAR(20)     NOT NULL
        CONSTRAINT chk_custom_rsvp_questions_type CHECK (question_type IN ('TEXT', 'YES_NO', 'CHOICE')),
    options       NVARCHAR(MAX)    NULL,
    required      BIT              NOT NULL DEFAULT 0,
    sort_order    INT              NOT NULL DEFAULT 0,
    is_active     BIT              NOT NULL DEFAULT 1,
    created_at    DATETIME2        NOT NULL DEFAULT SYSDATETIME(),
    updated_at    DATETIME2        NOT NULL DEFAULT SYSDATETIME(),

    CONSTRAINT fk_custom_rsvp_questions_couple
        FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE
);

CREATE INDEX idx_custom_rsvp_questions_couple ON custom_rsvp_questions(couple_id, sort_order);
GO

CREATE TABLE custom_rsvp_answers (
    id           UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
    question_id  UNIQUEIDENTIFIER NOT NULL,
    guest_id     UNIQUEIDENTIFIER NOT NULL,
    answer_text  NVARCHAR(MAX)    NOT NULL,
    created_at   DATETIME2        NOT NULL DEFAULT SYSDATETIME(),
    updated_at   DATETIME2        NOT NULL DEFAULT SYSDATETIME(),

    CONSTRAINT fk_custom_rsvp_answers_guest
        FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE CASCADE,
    CONSTRAINT fk_custom_rsvp_answers_question
        FOREIGN KEY (question_id) REFERENCES custom_rsvp_questions(id),
    CONSTRAINT uq_custom_rsvp_answers_guest_question UNIQUE (question_id, guest_id)
);

CREATE INDEX idx_custom_rsvp_answers_question ON custom_rsvp_answers(question_id);
