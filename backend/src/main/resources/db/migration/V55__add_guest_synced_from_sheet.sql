ALTER TABLE guests
    ADD synced_from_sheet BIT NOT NULL
        CONSTRAINT DF_guests_synced_from_sheet DEFAULT 0;
