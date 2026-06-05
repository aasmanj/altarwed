CREATE TABLE email_suppression (
    id            UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_email_suppression_id DEFAULT NEWID(),
    email_hash    NVARCHAR(64)     NOT NULL,
    created_at    DATETIME2        NOT NULL CONSTRAINT df_email_suppression_created_at DEFAULT GETUTCDATE(),
    source        NVARCHAR(50)     NOT NULL CONSTRAINT df_email_suppression_source DEFAULT 'USER_REQUEST',
    CONSTRAINT pk_email_suppression         PRIMARY KEY (id),
    CONSTRAINT uq_email_suppression_hash    UNIQUE      (email_hash)
);

CREATE INDEX ix_email_suppression_hash ON email_suppression (email_hash);
