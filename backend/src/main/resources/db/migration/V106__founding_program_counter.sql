-- Atomic founding-25 slot counter (issue #554, part 1).
--
-- The founding-vendor gate in VendorAuthService.register() was check-then-act: it read
-- countVerified() < cap, then, in a separate step, granted founding status. Two concurrent
-- registrations could both read the same pre-cap count and both be admitted, so a registration
-- burst could hand out more than the 25 founding (free-for-12-months) slots the program promises.
-- Pricing integrity only, but still a promise we must keep.
--
-- This single-row counter replaces the check-then-act with an atomic conditional UPDATE
-- (see VendorJpaRepository.claimFoundingSlot):
--
--     UPDATE founding_program SET slots_claimed = slots_claimed + 1
--     WHERE program_key = 'FOUNDING_25' AND slots_claimed < :cap
--
-- Because every concurrent caller updates the SAME row, SQL Server serializes them on that row's
-- exclusive lock: the second writer blocks until the first commits, then re-evaluates the guard
-- against the committed value. There is no write-skew (one row, not a range), so exactly :cap
-- grants can ever succeed regardless of concurrency or how many app instances run.
--
-- Seed: slots_claimed starts at the CURRENT verified-vendor count so the cutover is behaviour
-- neutral. Before this migration the gate closed once countVerified() reached the cap, so seeding
-- from that same count reproduces today's remaining-slots value exactly. From here on the counter
-- moves by exactly one per founding grant (the gate no longer conflates paid/comped verifications
-- with founding grants). The counter is never larger than countVerified(), so the public
-- founding-spots surface (which still reads countVerified()) can only ever under-report, never
-- advertise a slot the gate would then deny.
--
-- cap is NOT stored here: it stays config-driven (altarwed.vendor.founding-cap, default 25) and is
-- passed into the guard at grant time, so raising the cap simply reopens grants.
--
-- Inline DEFAULT constraints per the SQL Server + Flyway DDL rule in backend/CLAUDE.md.

CREATE TABLE founding_program (
    program_key   VARCHAR(40)      NOT NULL CONSTRAINT pk_founding_program PRIMARY KEY,
    slots_claimed INT              NOT NULL CONSTRAINT df_founding_program_slots DEFAULT 0,
    updated_at    DATETIME2        NOT NULL CONSTRAINT df_founding_program_updated_at DEFAULT GETUTCDATE()
);

INSERT INTO founding_program (program_key, slots_claimed, updated_at)
SELECT 'FOUNDING_25',
       (SELECT COUNT(*) FROM vendors WHERE is_verified = 1),
       GETUTCDATE();
