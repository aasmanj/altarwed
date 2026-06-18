# AltarWed Data Model (Schema Reference)

This is the **canonical reference** for the domain entities and their columns. It is a
read-on-demand document (not auto-loaded into context). **Update it whenever you add a Flyway
migration that changes the data model.**

- Migrations live in `backend/src/main/resources/db/migration/` (`V{n}__{description}.sql`).
- Next migration number is **derived from that directory** (highest `V{n}` + 1), never
  hardcoded here. See `backend/CLAUDE.md` for the rule.
- All tables use UUID primary keys. Schema changes are Flyway-only (never `ddl-auto`).

## Domain Entities (Flyway V1–V67, live in production)

- **Couple**, partnerOneName, partnerTwoName, email, weddingDate, denominationId. **Acquisition columns** (V46): utm_source/medium/campaign/term/content, referrer, landing_path, all nullable, captured once at registration (first-touch), modeled as an `AcquisitionSource` value object on the domain `Couple` record; read only by founder /admin/metrics.
- **Vendor**, businessName, category, city, state, isChristianOwned, denominationIds, isActive, isVerified. **Profile-enrichment fields** (V49): bio (1000), description (2000), websiteUrl (500), phone (30), all nullable. **Logo** (V51): logoUrl (500), nullable, stored in Azure Blob under `vendor-logos/{vendorId}/`. **Auth:** Vendors auto-verify on registration (isVerified=true); admin can unverify via `PATCH /api/v1/admin/vendors/{id}/unverify`. **Password reset** shares the same PasswordResetToken flow as couples (email-keyed, 15-min expiry). Admin notification email fires to `hello@altarwed.com` on every registration (property: `altarwed.admin.alert-email`)
- **Denomination**, 10 seeded (Baptist, Catholic, Presbyterian, etc.)
- **RefreshToken**, tokenHash, userId, userRole, expiresAt, revoked
- **VendorSubscription**, vendorId, planTier, status, stripeCustomerId (Stripe not yet wired)
- **WeddingWebsite** (V7+V8, V25 cleanup), slug, heroPhotoUrl, ourStory, scripture, venue, hotel, registry (3 slots), rsvpDeadline, isPublished, soft-delete. `testimony`, `covenantStatement`, `websitePin` columns dropped in V25.
- **PasswordResetToken** (V9), tokenHash, coupleId, expiresAt, used
- **Guest** (V10), coupleId, name, email, rsvpStatus, plusOneName, mealPreference, dietaryRestrictions, songRequest, shuttleNeeded
- **RsvpInviteToken** (V11), guestId, tokenHash, expiresAt, used
- **PlanningTask** (V13), coupleId, title, category, dueDateMonthsBefore, isCompleted, isSeeded, sortOrder
- **WeddingPrayer** (V14), weddingWebsiteId, guestName, prayerText, createdAt
- **WeddingPartyMember** (V15), weddingWebsiteId, name, role, side (BRIDE/GROOM/NEUTRAL), bio, photoUrl, sortOrder
- **BudgetItem** (V16), coupleId, category, vendorName, estimatedCost, actualCost, isPaid, notes
- **WeddingPhoto** (V17), weddingWebsiteId, blobUrl, caption, sortOrder, uploadedAt
- **WeddingWebsite** (V18 patch, dropped in V25), websitePin column removed; PIN privacy feature deprecated per walkthrough.
- **SeatingTable** (V19), coupleId, name, capacity, sortOrder; guests linked by tableNumber (1-based index)
- **BlogPost** (V23), slug, title, excerpt, content, author, publishedAt, seoTitle, seoDescription, tags. 6 posts seeded (V24, V28, V41): christian-wedding-ceremony-order, bible-verses-for-weddings, christian-wedding-vows, christian-wedding-planning-checklist, christian-wedding-songs, christian-unity-ceremony-ideas. V41 also strips em dashes from live blog content and adds an FAQ block to bible-verses-for-weddings. V42 adds a 7th post (christian-wedding-website), a bottom-of-funnel SEO/conversion landing page with a self-hosted (/public, relative) cover image.
- **WeddingHotel** (V30), normalized hotel block table (name, address, booking_url, block_rate, distance_from_venue, sort_order). Multiple rows per website. Replaces scalar hotel fields on WeddingWebsite for new UI; old fields retained.
- **GoogleSheetSync** (V31), one row per couple; sheet_url, last_synced, last_error, row_count, is_active. Scheduled job polls every 15 min and upserts guests.
- **Guest party fields** (V29), guests gain party_id (UUID grouping), party_name (display label), party_contact (bool, which guest in the party gets the invite email).
- **Vendor profile enrichment** (V49), bio (1000), description (2000), website_url (500), phone (30), all nullable, added to vendors table.
- **Inquiry** (V50), vendorId FK, couple_name, couple_email, wedding_date (nullable), message, is_read (default 0), created_at. Persisted when a couple submits the inquiry form on a vendor's public page. Vendor inbox: `GET /api/v1/vendors/me/inquiries`; mark-read: `PATCH /api/v1/vendors/me/inquiries/{id}/read` (ownership via `EXISTS` query, not full load). Public submit still at `POST /api/v1/inquiries`.
- **Vendor logo** (V51), logo_url NVARCHAR(500) nullable on vendors table. Uploaded via `POST /api/v1/vendors/me/logo` (multipart, 15 MB limit), stored in Azure Blob under `vendor-logos/{vendorId}/`. Shown on public vendor cards and detail page; falls back to letter avatar.
- **Vendor verification backfill** (V52), one-time UPDATE: sets `is_verified = 1` for all active vendors created before auto-verify was added to the registration flow. No schema change.
- **EmailSuppression** (V47), email_hash (SHA-256 of lowercased address, unique), source (USER_REQUEST / BOUNCE / COMPLAINT), created_at. Suppressed hashes are skipped by marketing sends (welcome, save-the-date). Unsubscribe links and the delivery webhook write here.
- **Save-the-date send tracking** (V66), guests.save_the_date_sent_at (nullable); stamped only for guests actually queued (valid, non-suppressed address), so the dashboard shows who was emailed.
- **EmailDelivery** (V67), per-email delivery log written by the Resend webhook (`POST /api/v1/webhooks/resend`, Svix-signed). Columns: resend_email_id (unique join key), guest_id, couple_id, email_type ("save-the-date" / "rsvp-invite"), recipient_email_hash, status (SENT/DELAYED/DELIVERED/COMPLAINED/BOUNCED), bounce_type/bounce_subtype, last_event_at. Maps a delivery/bounce event back to a guest via tags attached at send time; permanent bounces and complaints are auto-added to EmailSuppression. Guest list responses include the latest delivered/bounced status per email type.
- **Guest mailing address** (V34, V63, V64), structured fields on guests replacing freeform mail_address: mail_line1 (200), mail_city (100), mail_state (100, widened from NCHAR(2) in V63 for international provinces), mail_zip (NVARCHAR(20), widened from 10 in V64 after a Canadian postal code aborted the sheet sync; the V34 US-format CHECK constraints on state and zip were dropped in V63/V64), mail_country (100, V63; null = domestic US, non-null routes internationally via Lob).

## Active data conventions (load-bearing)

- **Partner mapping:** `partnerOneName` = Groom, `partnerTwoName` = Bride. DTO columns
  intentionally unchanged to avoid a rename migration.
- **Invite cap:** backend `MAX_INVITE_SENDS = 3`. Per-guest counter on
  `guests.invite_send_count`.
- **Scripture / testimony / covenant:** scripture stayed (load-bearing). Testimony, covenant
  statement, and PIN privacy were removed in V25 after the Katelyn+Luke walkthrough.
- **Soft delete (WeddingWebsite):** website data preserved; public page returns 404.
