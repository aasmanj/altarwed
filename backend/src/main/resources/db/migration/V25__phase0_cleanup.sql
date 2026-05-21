-- V25: Phase 0 walkthrough cleanup
-- Drops deprecated wedding-website features (testimony, covenant statement, PIN, prayer wall)
-- and adds the small columns needed by Phase 0 features
-- (guest note-for-couple, invite send cap, goal budget, planning task notes/assignee, vendor price tier).

------------------------------------------------------------
-- 0.3 Removals
------------------------------------------------------------

ALTER TABLE wedding_websites DROP COLUMN testimony;
ALTER TABLE wedding_websites DROP COLUMN covenant_statement;
ALTER TABLE wedding_websites DROP COLUMN website_pin;

DROP TABLE wedding_prayers;

------------------------------------------------------------
-- 0.4 Note for the couple (replaces public prayer wall)
------------------------------------------------------------

ALTER TABLE guests ADD note_for_couple NVARCHAR(1000) NULL;

------------------------------------------------------------
-- 0.6 Small feature columns
------------------------------------------------------------

ALTER TABLE wedding_websites ADD goal_budget DECIMAL(10,2) NULL;

ALTER TABLE guests ADD invite_send_count INT NOT NULL DEFAULT 0;

ALTER TABLE planning_tasks ADD notes NVARCHAR(MAX) NULL;
ALTER TABLE planning_tasks ADD assignee NVARCHAR(100) NULL;

-- Inline constraint avoids SQL Server parse-time "Invalid column name" error
-- when column and constraint are separate statements in the same transaction.
ALTER TABLE vendors ADD price_tier NVARCHAR(3) NULL
    CONSTRAINT chk_vendors_price_tier CHECK (price_tier IN ('$', '$$', '$$$') OR price_tier IS NULL);
