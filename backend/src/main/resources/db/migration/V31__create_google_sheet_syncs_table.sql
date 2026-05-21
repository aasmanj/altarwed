-- Stores a Google Sheet URL per couple for live guest list sync.
-- The sheet must be published publicly (File > Share > Publish to web > CSV).
-- A scheduled job polls every 15 minutes and upserts guests by name+email.
CREATE TABLE google_sheet_syncs (
    id          UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    couple_id   UNIQUEIDENTIFIER NOT NULL,
    sheet_url   NVARCHAR(2000)   NOT NULL,
    last_synced DATETIME2        NULL,
    last_error  NVARCHAR(1000)   NULL,
    row_count   INT              NULL,      -- number of rows processed in last sync
    is_active   BIT              NOT NULL DEFAULT 1,
    created_at  DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at  DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT fk_google_sheet_syncs_couple
        FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE,
    CONSTRAINT UQ_google_sheet_syncs_couple UNIQUE (couple_id)
);
