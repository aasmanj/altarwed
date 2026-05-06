CREATE TABLE seating_tables (
    id           UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
    couple_id    UNIQUEIDENTIFIER NOT NULL,
    name         NVARCHAR(100)    NOT NULL DEFAULT 'Table',
    capacity     INT              NOT NULL DEFAULT 8,
    sort_order   INT              NOT NULL DEFAULT 0,
    created_at   DATETIME2        NOT NULL DEFAULT SYSDATETIME(),
    updated_at   DATETIME2        NOT NULL DEFAULT SYSDATETIME(),

    CONSTRAINT fk_seating_tables_couple
        FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE
);

CREATE INDEX idx_seating_tables_couple ON seating_tables(couple_id);
