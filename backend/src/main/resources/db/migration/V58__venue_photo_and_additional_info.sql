-- V58: Add venue photo URL and additional info (parking, directions, etc.) to wedding_websites.

ALTER TABLE wedding_websites ADD venue_photo_url NVARCHAR(2000) NULL;
ALTER TABLE wedding_websites ADD venue_additional_info NVARCHAR(MAX) NULL;
