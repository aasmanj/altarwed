CREATE TABLE planning_tasks (
    id                  UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
    couple_id           UNIQUEIDENTIFIER  NOT NULL,
    title               NVARCHAR(300)     NOT NULL,
    category            NVARCHAR(50)      NOT NULL,
    due_months_before   INT               NULL,
    is_completed        BIT               NOT NULL DEFAULT 0,
    completed_at        DATETIME2         NULL,
    is_seeded           BIT               NOT NULL DEFAULT 1,
    sort_order          INT               NOT NULL DEFAULT 0,
    created_at          DATETIME2         NOT NULL,
    updated_at          DATETIME2         NOT NULL,

    CONSTRAINT fk_planning_tasks_couple FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE
);

CREATE INDEX idx_planning_tasks_couple_id ON planning_tasks(couple_id);
