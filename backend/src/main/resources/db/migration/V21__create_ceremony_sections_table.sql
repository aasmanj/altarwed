CREATE TABLE ceremony_sections (
    id            UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    couple_id     UNIQUEIDENTIFIER NOT NULL,
    title         NVARCHAR(200)    NOT NULL,
    section_type  NVARCHAR(50)     NOT NULL,
    content       NVARCHAR(MAX)    NULL,
    sort_order    INT              NOT NULL DEFAULT 0,
    created_at    DATETIME2        NOT NULL,
    updated_at    DATETIME2        NOT NULL,

    CONSTRAINT fk_ceremony_sections_couple
        FOREIGN KEY (couple_id) REFERENCES couples(id)
);
