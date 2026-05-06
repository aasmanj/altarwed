
# AltarWed — AI Assistant Instructions

## How to Communicate With Jordan
Jordan is learning as he builds — every explanation should be framed so he could defend it in a senior engineering interview. This means:
- Explain the **why** behind every decision, not just the what
- Call out trade-offs (why this approach over alternatives)
- Use correct technical vocabulary with a one-line definition when introducing a new term
- When fixing an error, explain what caused it and what the fix actually does
- Flag patterns that commonly appear in system design or DevOps interviews

## What We Are Building
AltarWed is a faith-first Christian wedding planning platform — a two-sided marketplace
connecting engaged Christian couples with faith-aligned wedding vendors. Think The Knot
or Zola, but built for Christian couples with covenant, scripture, and denomination at
the center.

**Core differentiator:** Every couple gets a shareable public wedding website at
`altarwed.com/wedding/[slug]` (e.g. `/wedding/jordan-and-sara`). Custom domain support
is a future paid feature. This is the primary viral/social sharing surface — every
couple who creates a site drives organic traffic and brand awareness.

**Go-to-market strategy:**
- Jordan and his fiancée will be the first couple to create their wedding website
- Their site will be used in Facebook ads, Pinterest campaigns, and organic social content
  to generate buzz and waitlist signups before the platform is fully open
- Vendors are NOT the initial focus — couples come first. Vendor self-serve and Stripe
  billing come after real couple usage is established (Phase 4+)
- The waitlist (already live at altarwed.com) captures early interest via Resend

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
- Azure Blob Storage (vendor photos, wedding media)
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

## Domain Entities
### Built and in production (V1–V6 Flyway migrations):
- Couple (UUID id, partnerOneName, partnerTwoName, email, weddingDate, denominationId)
- Vendor (UUID id, businessName, category, city, state, isChristianOwned, denominationIds)
- Denomination (UUID id, name, slug, traditions) — 10 seeded
- RefreshToken (UUID id, tokenHash, userId, userRole, expiresAt, revoked)
- VendorSubscription (UUID id, vendorId, planTier, status, stripeCustomerId, ...)

### Planned (not yet built):
- WeddingWebsite (UUID id, coupleId, slug, heroPhotoUrl, story, venueDetails, registryLinks, isPublished)
- Guest (UUID id, coupleId, name, email, rsvpStatus, dietaryRestrictions, tableNumber)
- Ceremony (UUID id, coupleId, denomination, scriptureVerses, vowText, orderOfService)
- Review (UUID id, vendorId, coupleId, rating, body, createdAt)

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
- UUID primary keys on all tables

## Security Rules
- Passwords hashed with BCrypt (strength 12)
- JWT signed with HS256
- Public endpoints (whitelist): POST /api/v1/auth/**, POST /api/v1/couples/register, 
  GET /api/v1/vendors/**, GET /api/v1/denominations/**
- All other endpoints require authentication
- CSRF disabled (stateless REST API)
- CORS configured for frontend origins only

## Azure Configuration
- App Service: backend Spring Boot JAR
- Static Web Apps: frontend-public (Next.js) and frontend-app (React)
- Azure SQL: primary database
- Azure Blob Storage: media files
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

## Monetization Context (affects data model decisions)
- Vendors pay monthly subscriptions (BASIC $29, FEATURED $79, PREMIUM $149)
- Couples have free and paid tiers (Covenant Plan $9/mo)
- Church partnerships: churches pay $99/mo for congregation access
- Stripe is the payment processor — VendorSubscription entity tracks this
- **Payments are Phase 4+ — do NOT add Stripe until real couple usage exists**

## Build Phases (reference for prioritization)
- **Phase 1 — DONE:** Backend API (auth, couples, vendors, denominations), marketing homepage,
  waitlist, CI/CD, Azure infrastructure, JWT auth, Flyway schema
- **Phase 2 — DONE:** Couple wedding website live at altarwed.com/wedding/[slug]. Backend:
  WeddingWebsite entity (V7 migration), full CRUD API, soft delete (V8 migration), duplicate
  protection. Frontend: Next.js SSR public page. Dashboard: app.altarwed.com deployed to Azure
  Static Web Apps with custom domain. Auth flow working end to end. Security hardened:
  rate limiting (Bucket4j), Swagger disabled in prod, catch-all exception handlers.
- **Phase 3 — COMPLETE:**
  (a) Password reset flow — done. V9 migration, Resend email, time-limited token.
  (b) Guest list + RSVP — done. V10 (guests) + V11 (rsvp invite tokens) migrations live in prod.
      RSVP emails send from "Jordan & Eden-Faith" via Resend. Public RSVP page at altarwed.com/rsvp/[token].
  (c) Email deliverability — SPF + DKIM + DMARC configured. 10/10 mail-tester.com score.
- **Phase 3b — IN PROGRESS (current focus):**
  (a) Wedding planning checklist / timeline — faith-first checklist with items like book pre-marital
      counseling, choose scripture readings, meet with pastor. Backend: PlanningTask entity + API.
      Dashboard: checklist UI with completion tracking. Differentiator: denomination-aware tasks.
  (b) Custom RSVP questions — extend RSVP to collect meal preference, dietary restrictions,
      song requests, shuttle needs. Backend: RsvpAnswer entity, flexible question/answer schema.
  (c) Prayer wall — guests visiting the wedding website can leave a prayer/blessing for the couple.
      Backend: WeddingPrayer entity scoped to WeddingWebsite. Public-facing, viral on Christian social.
- **Phase 4 — Vendor portal + couple open beta:**
  (a) Vendor self-serve portal — vendor registration in frontend-app, vendor dashboard (name, category,
      photos, bio, location, denomination, isChristianOwned). Public /vendors browse page in
      frontend-public. Goal: onboard Jordan's photographer friends as first real vendors.
      Backend entity + endpoints already exist — frontend work is the gap.
  (b) Open couple signup — app.altarwed.com registration is already live. Share publicly.
      Any couple can sign up and their site goes live at altarwed.com/wedding/[slug].
      Polish onboarding UX so first-time couples can self-serve without help.
  (c) Registry links section — couples add Amazon/Target/Crate & Barrel registry URLs.
      Displayed beautifully on public wedding website. Low effort, high perceived completeness.
  (d) Accommodations section — hotel block details, Airbnb links, travel info on wedding website.
      Just content fields on WeddingWebsite entity.
- **Phase 5 — Engagement + retention features:**
  (a) Budget tracker — tracks vendor costs, total budget, payments. Locks couples into platform.
      Faith angle: optional tithing/donation goal line item.
  (b) Seating chart — drag-and-drop guest table assignments. Guest data already exists from Phase 3.
  (c) Digital save-the-dates — designed email template generator. Scripture verse + faith motifs.
  (d) Wedding website password protection — optional PIN so only invited guests can view.
  (e) Guest photo sharing / album — guests upload photos post-wedding. Azure Blob already wired.
      Crowd-sourced album, real-time slideshow for reception. WithJoy's best feature.
- **Phase 6 — Faith-first differentiators (no competitor has these):**
  (a) Scripture builder — searchable ESV/NIV scripture library, curated wedding verses,
      couples pin verses to their wedding website. Zero competitors have this.
  (b) Vow builder — guided vow writing tool with prompts and optional scripture integration.
  (c) Denomination-aware content — Catholic couples see Pre-Cana reminders, Baptist couples
      see different ceremony structure prompts. Uses existing Denomination entity.
  (d) Ceremony builder — order of service, scripture readings, vow text (Phase 6 original scope).
- **Phase 7:** Stripe billing (vendor subscriptions $29/$79/$149), couple premium tier ($9/mo Covenant Plan)

## Wedding Website Feature (Phase 2) — COMPLETE
- Live URL: altarwed.com/wedding/jordan-and-eden-faith
- Dashboard: app.altarwed.com (React + Vite, Azure Static Web Apps)
- Slug system: unique, URL-safe, lowercase-hyphenated, chosen at setup
- SSR via Next.js for Open Graph social sharing previews
- Soft delete: DELETE /api/v1/wedding-websites/couple/{id} — data preserved, page returns 404
- One couple = one website enforced at service layer (domain invariant)
- Photos: Azure Blob Storage + CDN (upload UI not yet built)
- Custom domain per couple: future paid feature — slug system already supports it

## When You Are Unsure
- Follow hexagonal architecture over convenience
- Choose the more testable option
- Prefer explicit over implicit
- If adding a new dependency, explain why in a comment
- Always explain the trade-off of architecture decisions
