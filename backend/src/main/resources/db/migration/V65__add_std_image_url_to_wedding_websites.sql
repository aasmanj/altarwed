-- V65: Custom save-the-date image uploaded by the couple (e.g. a Canva-designed PNG).
-- Embedded as an <img> at the top of the Resend STD email template when set.
ALTER TABLE wedding_websites ADD std_image_url NVARCHAR(2000) NULL;
