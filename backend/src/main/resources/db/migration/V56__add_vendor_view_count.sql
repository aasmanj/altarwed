ALTER TABLE vendors ADD view_count INT NOT NULL CONSTRAINT DF_vendors_view_count DEFAULT 0;
