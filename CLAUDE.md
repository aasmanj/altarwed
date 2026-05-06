
# AltarWed — AI Assistant Instructions

## How to Communicate With Jordan
Jordan is learning as he builds — every explanation should be framed so he could defend it in a senior engineering interview. This means:
- Explain the **why** behind every decision, not just the what
- Call out trade-offs (why this approach over alternatives)
- Use correct technical vocabulary with a one-line definition when introducing a new term
- When fixing an error, explain what caused it and what the fix actually does
- Flag patterns that commonly appear in system design or DevOps interviews
- **After every coding response, include a "Senior engineer thinking" section** — 2–4 bullet points connecting what was just built to a broader CS/system design concept Jordan should be able to explain in an interview (e.g. ISR vs SSR trade-offs, optimistic updates, hexagonal architecture decisions, cache invalidation strategies, why we use boxed vs primitive types in DTOs, etc.)

## What We Are Building
AltarWed is a faith-first Christian wedding planning platform — a two-sided marketplace
connecting engaged Christian couples with faith-aligned wedding vendors. Think The Knot
or Zola, but built for Christian couples with covenant, scripture, and denomination at
the center.

**Core differentiator:** Every couple gets a shareable public wedding website at
`altarwed.com/wedding/[slug]` (e.g. `/wedding/jordan-and-eden-faith`). Custom domain support
is a future paid feature. This is the primary viral/social sharing surface — every
couple who creates a site drives organic traffic and brand awareness.

**Go-to-market strategy:**
- Jordan and his fiancée will be the first couple to create their wedding website
- Their site will be used in Facebook ads, Pinterest campaigns, and organic social content
  to generate buzz and waitlist signups before the platform is fully open
- Vendors are NOT the initial focus — couples come first. Vendor self-serve and Stripe
  billing come after real couple usage is established (Phase 4+)
- The waitlist (already live at altarwed.com) captures early interest via Resend
- Business Pinterest and Facebook accounts are created and ready for content

**Reliability goal:** Spare no expense within reason. Current: B2 App Service.
Upgrade path when traffic grows: B2 → P1v3 (auto-scale), add Azure Front Door (CDN +
global failover), Azure SQL Business Critical tier. Do not over-provision prematurely.

## Monorepo Structure
- backend/          → Spring Boot 4 REST API (Java 21, Gradle Kotlin DSL)
- frontend-public/  → Next.js (SSR for SEO — public pages, blog, vendor directory)
- frontend-app/     → React + Vite (SPA — authenticated couple/vendor dashboards)
- infrastructure/   → Azure Bicep IaC files
- .github/          → CI/CD GitHub Actions workflows

## Backend Stack
- Java 21 (use virtual threads, Records for DTOs, pattern matching)
- Spring Boot 4.0.6
- Gradle Kotlin DSL (build.gradle.kts)
- Spring Security 7 (SecurityFilterChain ONLY — never WebSecurityConfigurerAdapter)
- JWT auth: access tokens (15 min) + refresh tokens (7 days)
- Spring Data JPA + Flyway migrations
- Azure SQL Database (SQL Server dialect)
- Azure Blob Storage (vendor photos, wedding media) — SDK wired, container: altarwed-media
- SpringDoc OpenAPI (auto-generated API docs)

## Frontend Stack
- frontend-public: Next.js 14, TypeScript, Tailwind CSS (SSR for SEO)
- frontend-app: React 18, Vite, TypeScript, Tailwind CSS, React Query, React Router v6

## Architecture: Hexagonal (Ports & Adapters)
This is NON-NEGOTIABLE. Always follow this pattern:

### Package responsibilities:
- domain/model/       → Pure Java Records. ZERO Spring/JPA imports. Ever.
- domain/port/        → Plain Java interfaces. No Spring annotations.
- domain/exception/   → Business exceptions extending RuntimeException.
- application/service/→ Orchestrates domain. Injects ports (not JPA repos directly).
- application/dto/    → Java Records with Bean Validation annotations.
- infrastructure/persistence/entity/ → JPA entities (@Entity). Never used in domain.
- infrastructure/persistence/repository/ → Spring Data JPA repos.
- infrastructure/persistence/ → Adapters implementing domain ports.
- infrastructure/security/ → JWT, UserDetails, SecurityConfig.
- infrastructure/azure/ → Blob Storage implementations.
- web/controller/     → REST controllers. Call services only, never repos.
- web/mapper/         → Map between domain models and DTOs.
- web/exception/      → @RestControllerAdvice GlobalExceptionHandler.

### The Dependency Rule (NEVER violate this):
web → application → domain ← infrastructure

domain has ZERO imports from: Spring, JPA, infrastructure, web.
If you find yourself importing springframework.* in domain/ — STOP and restructure.

## Domain Entities — Built and Live
All entities below have Flyway migrations in production (V1–V15):
- **Couple** — partnerOneName, partnerTwoName, email, weddingDate, denominationId
- **Vendor** — businessName, category, city, state, isChristianOwned, denominationIds, isActive, isVerified
- **Denomination** — 10 seeded (Baptist, Catholic, Presbyterian, etc.)
- **RefreshToken** — tokenHash, userId, userRole, expiresAt, revoked
- **VendorSubscription** — vendorId, planTier, status, stripeCustomerId (Stripe not yet wired)
- **WeddingWebsite** (V7+V8) — slug, heroPhotoUrl, ourStory, testimony, covenantStatement, scripture, venue, hotel, registry (3 slots), rsvpDeadline, isPublished, soft-delete
- **PasswordResetToken** (V9) — tokenHash, coupleId, expiresAt, used
- **Guest** (V10) — coupleId, name, email, rsvpStatus, plusOneName, mealPreference, dietaryRestrictions, songRequest, shuttleNeeded
- **RsvpInviteToken** (V11) — guestId, tokenHash, expiresAt, used
- **PlanningTask** (V13) — coupleId, title, category, dueDateMonthsBefore, isCompleted, isSeeded, sortOrder
- **WeddingPrayer** (V14) — weddingWebsiteId, guestName, prayerText, createdAt
- **WeddingPartyMember** (V15) — weddingWebsiteId, name, role, side (BRIDE/GROOM/NEUTRAL), bio, photoUrl, sortOrder
- **BudgetItem** (V16) — coupleId, category, vendorName, estimatedCost, actualCost, isPaid, notes
- **WeddingPhoto** (V17) — weddingWebsiteId, blobUrl, caption, sortOrder, uploadedAt
- **WeddingWebsite** (V18 patch) — websitePin column added (NVARCHAR 10, nullable)
- **SeatingTable** (V19) — coupleId, name, capacity, sortOrder; guests linked by tableNumber (1-based index)

## User Roles
- COUPLE → can manage their wedding, guests, ceremony, vendor messaging
- VENDOR → can manage their listing, respond to inquiries, view analytics
- ADMIN → platform management (future)

## Code Standards — ALWAYS follow these

### Java:
- DTOs MUST be Java Records (not classes)
- Constructor injection ONLY (never @Autowired on fields)
- @Transactional on service methods that write to DB
- Domain models are Java Records — immutable
- JPA entities are classes with @Entity — never Records
- Always separate the JPA entity from the domain model
- Write a mapper (toDomain / toEntity) in the adapter class
- API versioning: all endpoints under /api/v1/
- Use boxed types (Integer, Boolean) in DTOs — never primitives. Primitives can't represent "not provided" in JSON; Jackson fails rather than defaulting.

### Testing:
- domain/ tests: pure JUnit 5, no Spring context
- application/ tests: Mockito mocks, no Spring context  
- web/ tests: @WebMvcTest slice only (no full context)
- infrastructure/ tests: @DataJpaTest with H2 in-memory
- Target: 80% coverage on application/service/ layer

### Gradle:
- Always use implementation/compileOnly/runtimeOnly/testImplementation correctly
- Lombok: compileOnly + annotationProcessor
- JDBC drivers: runtimeOnly
- Test libs: testImplementation

## Database Rules
- NEVER use spring.jpa.hibernate.ddl-auto=create or update in any environment
- ALL schema changes go through Flyway migrations in db/migration/
- Migration naming: V{number}__{description}.sql (e.g. V1__create_couples_table.sql)
- Next migration number: V16
- UUID primary keys on all tables

## Security Rules
- Passwords hashed with BCrypt (strength 12)
- JWT signed with HS256
- JWT principal is email string; userId is a custom claim extracted via JwtService.extractUserId()
- Public endpoints (whitelist): POST /api/v1/auth/**, POST /api/v1/couples/register,
  GET /api/v1/vendors/**, GET /api/v1/denominations/**,
  GET /api/v1/wedding-websites/slug/**, GET /api/v1/wedding-websites/published,
  GET+POST /api/v1/prayers/website/**, GET /api/v1/guests/rsvp/**, POST /api/v1/guests/rsvp,
  GET /api/v1/wedding-party/website/**
- All other endpoints require authentication
- CSRF disabled (stateless REST API)
- CORS configured for frontend origins only
- Rate limiting via Bucket4j (in-memory, per instance)
- Swagger/OpenAPI disabled in prod profile

## Azure Configuration
- App Service: backend Spring Boot JAR (B2 tier)
- Static Web Apps: frontend-public (Next.js) and frontend-app (React)
- Azure SQL: primary database
- Azure Blob Storage: media files — connection string via AZURE_STORAGE_CONNECTION_STRING, container: altarwed-media. Set container public access to "Blob" for image URLs to be publicly readable.
- Azure Key Vault: all secrets (never hardcode secrets)
- Azure CDN: static assets and media delivery
- Azure Application Insights: observability

## SEO Rules (frontend-public only)
- ALL public pages must be server-side rendered (Next.js SSR/SSG)
- Every page needs: title tag, meta description, Open Graph tags
- Vendor pages need LocalBusiness schema.org JSON-LD
- Blog posts need Article schema.org JSON-LD
- Dynamic sitemap generated from DB at /sitemap.xml
- URLs are lowercase, hyphenated, keyword-rich
- ISR (revalidate) values: wedding pages = 60s, vendor pages = 15s (new vendors appear quickly), prayers = 30s

## What NOT to Do — Ever
- Never put @Entity on a domain model Record
- Never import infrastructure.* in domain.*
- Never import web.* in application.*  
- Never call a JPA repository directly from a controller
- Never store plain text passwords
- Never hardcode secrets, API keys, or connection strings
- Never use ddl-auto=create/update in production
- Never skip Flyway — all migrations are versioned and irreversible
- Never use WebSecurityConfigurerAdapter (removed in Spring Security 6+)
- Never use RestTemplate for new code (use RestClient or @HttpExchange)
- Never use primitive types in DTO Records (use boxed: Integer not int, Boolean not boolean)

## Monetization Context (affects data model decisions)
- Vendors pay monthly subscriptions (BASIC $29, FEATURED $79, PREMIUM $149)
- Couples have free and paid tiers (Covenant Plan $9/mo)
- Church partnerships: churches pay $99/mo for congregation access
- Stripe is the payment processor — VendorSubscription entity tracks this
- **Payments are Phase 7 — do NOT add Stripe until vendor + couple usage is established**

## Build Phases — Current Status

### ✅ Phase 1 — COMPLETE
Backend API (auth, couples, vendors, denominations), marketing homepage, waitlist, CI/CD, Azure infrastructure, JWT auth, Flyway schema.

### ✅ Phase 2 — COMPLETE
Couple wedding website live at altarwed.com/wedding/[slug]. WeddingWebsite entity (V7+V8), full CRUD + soft delete, duplicate slug protection. Next.js SSR public page. Dashboard at app.altarwed.com (Azure Static Web Apps, custom domain). Auth end-to-end. Rate limiting (Bucket4j), Swagger disabled in prod, global exception handler.

### ✅ Phase 3 — COMPLETE
(a) Password reset — V9 migration, Resend email, time-limited token.
(b) Guest list + RSVP — V10 (guests) + V11 (rsvp tokens). Custom RSVP fields: meal preference, dietary restrictions, song request, shuttle. RSVP emails from "Jordan & Eden-Faith" via Resend. Public RSVP page at altarwed.com/rsvp/[token].
(c) Email deliverability — SPF + DKIM + DMARC. 10/10 mail-tester.com score.

### ✅ Phase 3b — COMPLETE
(a) Wedding planning checklist — V13 migration. PlanningTask entity. 27 faith-first seeded tasks (lazy-seeded on first GET). Dashboard checklist UI with progress bar, category grouping, category filters, custom task support.
(b) Custom RSVP fields — meal, dietary, song request, shuttle. Frontend wired.
(c) Prayer wall — V14 migration. WeddingPrayer entity. Public submit + list on wedding page. PrayerWallSection client component with optimistic update.
(d) Wedding party — V15 migration. WeddingPartyMember entity. Side: BRIDE/GROOM/NEUTRAL (officiant, readers, musicians). Photo upload via Azure Blob (15 MB limit, JPEG/PNG/WebP). Dashboard add/edit/delete/photo. Public wedding page: photo grid grouped by side, NEUTRAL shown first as "Ceremony".

### ✅ Phase 4 — COMPLETE
(a) Vendor portal — GET/PATCH /api/v1/vendors/me. Vendor registration at app.altarwed.com/register/vendor. Vendor listing editor at /vendor/listing. VendorDashboard links live.
(b) Open couple signup — 3-step onboarding wizard (names → URL slug + date → confirm). Auto-generates slug from partner names. Shows for new users with no website.
(c) Registry links — already in WeddingWebsite entity. Editor tab live. Displayed on public wedding page.
(d) Accommodations — hotel block fields already in WeddingWebsite entity. Editor "Hotel" tab live. Displayed on public wedding page.
(e) Public vendor directory — altarwed.com/vendors (SSR, category filter chips, city search). altarwed.com/vendors/[id] detail page with Open Graph metadata.
(f) Public wedding page redesign — sticky tab nav (Our Story/Details/Wedding Party/Registry/Travel/Prayer Wall), gradient hero, gold ornament section headings, RSVP callout card, partner names used as section labels.
(g) Site-wide navigation — shared SiteHeader (sticky, all public pages) + SiteFooter (4-column). Homepage nav updated. Wedding pages show discreet "Created with AltarWed" bar for viral discovery.

### ✅ Phase 5 — COMPLETE
(a) Budget tracker — V16 migration. BudgetItem entity. Dashboard UI: category grouping, estimated vs actual, paid toggle, running totals.
(b) Seating chart — V19 migration. SeatingTable entity (named tables, per-table capacity). Drag-and-drop with @dnd-kit/core. Over-capacity indicator. Guests linked by tableNumber (1-based index into sorted tables array). Full create/edit/delete modal.
(c) Digital save-the-dates — Faith-themed HTML email (Colossians 3:14 footer, gold/cream palette). SendTheDateController: POST /api/v1/save-the-dates/couple/{coupleId}/send. Dashboard preview + send UI.
(d) Wedding website PIN protection — V18 migration (website_pin column). Opt-in toggle in Privacy tab. PinGate client component (sessionStorage-backed). Hero/names visible; tabs gated. PIN never returned in API response (only isPinProtected boolean). Public verify-pin endpoint whitelisted.
(e) Guest photo sharing / album — V17 migration. WeddingPhoto entity. Azure Blob upload at POST /api/v1/uploads/wedding-websites/{websiteId}/photos. Dashboard grid UI with caption edit + delete. ⚠️ Verify this backend endpoint exists before testing — may need to be built.
- Async email — AsyncConfig (ThreadPoolTaskExecutor, 4–10 threads, queue 200, CallerRunsPolicy). AsyncEmailService wraps all sends with @Async. GuestService + PasswordResetService updated.
- @/ path alias enforced — .eslintrc.json no-restricted-imports bans relative parent imports across frontend-public.
- Next Flyway migration: V20

### 🔜 Phase 6 — Faith-first differentiators (NEXT)
(a) Scripture builder — searchable ESV/NIV library, curated wedding verses, pin to website.
(b) Vow builder — guided writing tool with scripture integration.
(c) Denomination-aware content — Pre-Cana reminders for Catholics, etc.
(d) Ceremony builder — order of service, scripture readings, vow text.

### 🔜 Phase 7 — Stripe billing
Vendor subscriptions ($29/$79/$149), couple Covenant Plan ($9/mo).

## Wedding Website Feature — Live Details
- URL pattern: altarwed.com/wedding/[slug]
- Dashboard: app.altarwed.com/dashboard/website
- Hero photo upload: POST /api/v1/uploads/wedding-websites/{websiteId}/hero
- Wedding party photo upload: POST /api/v1/uploads/wedding-party/{websiteId}/{memberId}/photo
- Photo album upload: POST /api/v1/uploads/wedding-websites/{websiteId}/photos (⚠️ verify exists)
- All upload endpoints require authentication and validate file type + 15 MB size limit
- Soft delete: website data preserved, public page returns 404

## When You Are Unsure
- Follow hexagonal architecture over convenience
- Choose the more testable option
- Prefer explicit over implicit
- If adding a new dependency, explain why in a comment
- Always explain the trade-off of architecture decisions
