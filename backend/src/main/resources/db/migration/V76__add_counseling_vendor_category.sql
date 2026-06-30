-- Add COUNSELING to the vendor category enum (pre-marital / faith-based counseling).
-- SQL Server CHECK constraints require a DROP + ADD to modify the allowed value list.
ALTER TABLE vendors DROP CONSTRAINT chk_vendors_category;
ALTER TABLE vendors ADD CONSTRAINT chk_vendors_category CHECK (category IN (
    'PHOTOGRAPHER', 'VIDEOGRAPHER', 'FLORIST', 'CATERER', 'VENUE',
    'OFFICIANT', 'MUSIC', 'CAKE', 'HAIR_AND_MAKEUP', 'INVITATION',
    'TRANSPORTATION', 'COORDINATOR', 'ALTERATIONS', 'COUNSELING', 'OTHER'
));
