-- Issue #42: access_token/refresh_token now store AES-256-GCM ciphertext (the
-- "gcm:v1:<iv>:<ciphertext>" envelope from TokenEncryptionService), not the raw Google token.
-- Encryption + base64 + the envelope inflates length by roughly 1.37x plus ~24 chars of
-- overhead, so the original NVARCHAR(2000) (sized for plaintext) can truncate-fail a save for
-- a token near Google's stated ~2048-byte ceiling. Widen ahead of the encryption code path
-- going live so no couple's token save can hit "String or binary data would be truncated".
ALTER TABLE google_oauth_tokens ALTER COLUMN access_token NVARCHAR(4000) NOT NULL;
ALTER TABLE google_oauth_tokens ALTER COLUMN refresh_token NVARCHAR(4000) NOT NULL;
