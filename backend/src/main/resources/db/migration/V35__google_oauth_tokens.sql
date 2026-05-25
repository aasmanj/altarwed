-- Stores Google OAuth tokens per couple for Google Sheets sync.
-- Access tokens expire in ~1 hour; refresh tokens are long-lived and used
-- to obtain new access tokens automatically.
CREATE TABLE google_oauth_tokens (
    id                UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID()        CONSTRAINT pk_google_oauth_tokens PRIMARY KEY,
    couple_id         UNIQUEIDENTIFIER NOT NULL UNIQUE,
    access_token      NVARCHAR(2000)   NOT NULL,
    refresh_token     NVARCHAR(2000)   NOT NULL,
    token_type        NVARCHAR(50)     NOT NULL DEFAULT 'Bearer',
    expires_at        DATETIMEOFFSET   NOT NULL,
    google_email      NVARCHAR(300)    NULL,
    scope             NVARCHAR(500)    NULL,
    created_at        DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    updated_at        DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET()
);
