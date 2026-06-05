ALTER TABLE couples
    ADD marketing_consent BIT NOT NULL CONSTRAINT df_couples_marketing_consent DEFAULT 0;
