CREATE TABLE guests (
    id               UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
    couple_id        UNIQUEIDENTIFIER NOT NULL,
    name             NVARCHAR(200)    NOT NULL,
    email            NVARCHAR(300)    NULL,
    phone            NVARCHAR(50)     NULL,
    rsvp_status      NVARCHAR(20)     NOT NULL DEFAULT 'PENDING',
    plus_one_allowed BIT              NOT NULL DEFAULT 0,
    plus_one_name    NVARCHAR(200)    NULL,
    dietary_restrictions NVARCHAR(500) NULL,
    table_number     INT              NULL,
    side             NVARCHAR(10)     NULL,
    notes            NVARCHAR(MAX)    NULL,
    invite_sent_at   DATETIME2        NULL,
    responded_at     DATETIME2        NULL,
    created_at       DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at       DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT fk_guests_couple FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE,
    CONSTRAINT chk_guests_rsvp_status CHECK (rsvp_status IN ('PENDING', 'ATTENDING', 'DECLINING', 'MAYBE')),
    CONSTRAINT chk_guests_side CHECK (side IN ('BRIDE', 'GROOM', 'BOTH') OR side IS NULL)
);

CREATE INDEX ix_guests_couple_id   ON guests(couple_id);
CREATE INDEX ix_guests_rsvp_status ON guests(couple_id, rsvp_status);
