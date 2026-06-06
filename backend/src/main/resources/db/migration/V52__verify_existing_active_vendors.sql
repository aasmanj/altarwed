-- Vendors created before auto-verify was added to the registration flow have
-- is_verified = 0. The public directory query requires is_verified = 1, so these
-- vendors are invisible to couples despite being active. This one-time migration
-- verifies all currently active vendors.
-- New registrations auto-verify at the service layer, so this only runs once.
UPDATE vendors SET is_verified = 1 WHERE is_active = 1 AND is_verified = 0;
