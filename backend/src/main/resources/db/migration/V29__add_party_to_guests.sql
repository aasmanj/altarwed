-- Add party support to guests.
-- party_id: shared UUID for guests in the same party. NULL for solo guests.
-- party_name: display name for the group (e.g. "The Smith Family"). NULL for solo guests.
-- party_is_contact: exactly one guest per party is the contact who receives the invite email.
ALTER TABLE guests
    ADD party_id      UNIQUEIDENTIFIER NULL,
        party_name    NVARCHAR(100)    NULL,
        party_contact BIT              NOT NULL CONSTRAINT DF_guests_party_contact DEFAULT 0;

CREATE INDEX IX_guests_party_id ON guests (party_id) WHERE party_id IS NOT NULL;
