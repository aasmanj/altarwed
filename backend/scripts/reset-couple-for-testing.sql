-- ──────────────────────────────────────────────────────────────────────────
-- Reset a single couple's data so they can re-experience onboarding from
-- scratch. Keeps the couples row (and thus login credentials + refresh tokens)
-- but wipes everything else attached to them or their wedding website.
--
-- Designed for Jordan's own QA: walk through onboarding as a brand-new user
-- without losing the auth account. NOT a self-serve feature yet — couples
-- shouldn't be able to nuke their own data without a confirm flow we haven't
-- built. Run this manually via Azure Portal Query Editor against the prod DB
-- (altarwed-prod-sql / altarwed) by an admin who knows what they're doing.
--
-- How to run:
--   1. Azure Portal → SQL databases → altarwed → Query editor (preview)
--   2. Sign in with the sqladmin credentials from altarwed-prod-kv
--   3. Set @target_email below to the account you want to reset
--   4. Run the PREVIEW block first (uncommented by default). It only reads.
--   5. If the counts look right, comment out the PREVIEW block, uncomment
--      the DELETE block (BEGIN TRAN … COMMIT), and run.
--   6. After committing, sign out of app.altarwed.com and back in. The
--      onboarding wizard should fire on next dashboard visit.
-- ──────────────────────────────────────────────────────────────────────────

DECLARE @target_email NVARCHAR(255) = 'aasmanj@gmail.com';
DECLARE @couple_id    UNIQUEIDENTIFIER = (SELECT id FROM couples WHERE email = @target_email);
DECLARE @website_id   UNIQUEIDENTIFIER = (SELECT id FROM wedding_websites WHERE couple_id = @couple_id);

IF @couple_id IS NULL
BEGIN
    RAISERROR('No couple found for email %s — aborting.', 16, 1, @target_email);
    RETURN;
END;

-- ── PREVIEW (read-only). Shows what the DELETE block below would touch. ──
SELECT 'couple'                 AS table_name, COUNT(*) AS rows_affected FROM couples                WHERE id = @couple_id
UNION ALL SELECT 'wedding_websites',          COUNT(*) FROM wedding_websites      WHERE couple_id = @couple_id
UNION ALL SELECT 'wedding_page_blocks',       COUNT(*) FROM wedding_page_blocks   WHERE wedding_website_id = @website_id
UNION ALL SELECT 'wedding_party_members',     COUNT(*) FROM wedding_party_members WHERE wedding_website_id = @website_id
UNION ALL SELECT 'wedding_photos',            COUNT(*) FROM wedding_photos        WHERE wedding_website_id = @website_id
UNION ALL SELECT 'wedding_hotels',            COUNT(*) FROM wedding_hotels        WHERE website_id        = @website_id
UNION ALL SELECT 'guests',                    COUNT(*) FROM guests                WHERE couple_id = @couple_id
UNION ALL SELECT 'rsvp_invite_tokens',        COUNT(*) FROM rsvp_invite_tokens    WHERE guest_id IN (SELECT id FROM guests WHERE couple_id = @couple_id)
UNION ALL SELECT 'planning_tasks',            COUNT(*) FROM planning_tasks        WHERE couple_id = @couple_id
UNION ALL SELECT 'budget_items',              COUNT(*) FROM budget_items          WHERE couple_id = @couple_id
UNION ALL SELECT 'seating_tables',            COUNT(*) FROM seating_tables        WHERE couple_id = @couple_id
UNION ALL SELECT 'ceremony_sections',         COUNT(*) FROM ceremony_sections     WHERE couple_id = @couple_id
UNION ALL SELECT 'google_sheet_syncs',        COUNT(*) FROM google_sheet_syncs    WHERE couple_id = @couple_id
UNION ALL SELECT 'google_oauth_tokens',       COUNT(*) FROM google_oauth_tokens   WHERE couple_id = @couple_id
UNION ALL SELECT 'password_reset_tokens',     COUNT(*) FROM password_reset_tokens WHERE email     = @target_email
UNION ALL SELECT 'print_orders',              COUNT(*) FROM print_orders          WHERE couple_id = @couple_id;

/* ── DELETE block. Uncomment the BEGIN/COMMIT pair below when ready. ──
   Wrapped in a transaction so a partial failure rolls everything back.
   Order matters: children before parents, even with cascade FKs, to keep
   the intent obvious in the audit trail.

BEGIN TRAN;

    -- print_order_recipients references both print_orders and guests; clean it first.
    DELETE FROM print_order_recipients WHERE print_order_id IN (SELECT id FROM print_orders WHERE couple_id = @couple_id);
    DELETE FROM print_order_recipients WHERE guest_id        IN (SELECT id FROM guests        WHERE couple_id = @couple_id);
    DELETE FROM print_orders            WHERE couple_id = @couple_id;

    -- Couple-owned (no cascade from couples since we're not deleting the couple).
    DELETE FROM rsvp_invite_tokens      WHERE guest_id IN (SELECT id FROM guests WHERE couple_id = @couple_id);
    DELETE FROM guests                  WHERE couple_id = @couple_id;
    DELETE FROM planning_tasks          WHERE couple_id = @couple_id;
    DELETE FROM budget_items            WHERE couple_id = @couple_id;
    DELETE FROM seating_tables          WHERE couple_id = @couple_id;
    DELETE FROM ceremony_sections       WHERE couple_id = @couple_id;
    DELETE FROM google_sheet_syncs      WHERE couple_id = @couple_id;
    DELETE FROM google_oauth_tokens     WHERE couple_id = @couple_id;
    DELETE FROM password_reset_tokens   WHERE email     = @target_email;

    -- wedding_websites has CASCADE on blocks / party / photos / hotels,
    -- so the children clean themselves when we drop the parent row.
    DELETE FROM wedding_websites        WHERE couple_id = @couple_id;

    -- Keep: couples (login), refresh_tokens (active session — though sign-out
    -- recommended anyway since the JWT still carries a coupleId).

COMMIT;
*/
