
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
- **Phase 2 — NEXT:** Couple wedding website (public page at /wedding/[slug]) — this is the
  core viral feature. Lives in frontend-public (Next.js SSR). Backend: WeddingWebsite entity,
  API endpoints, Blob Storage for hero photo upload.
- **Phase 3:** Guest list + RSVP in frontend-app dashboard. Email invites via Resend.
- **Phase 4:** Vendor browsing (read-only, free) — vendor self-serve listings, couple can
  browse and favorite vendors
- **Phase 5:** Stripe billing (vendor subscriptions), couple premium tier
- **Phase 6:** Ceremony builder, scripture tools, denomination-aware content

## Wedding Website Feature (Phase 2) — key design decisions
- URL pattern: `altarwed.com/wedding/[slug]` (e.g. /wedding/jordan-and-sara)
- Slug is chosen by couple at setup, must be unique, URL-safe, lowercase-hyphenated
- Page is SSR (Next.js) for social sharing previews — Open Graph image with couple names
- Sections: hero photo, countdown to wedding date, our story, event details, registry links,
  RSVP link, scripture verse, denomination context
- Photos stored in Azure Blob Storage, served via Azure CDN
- Page is public by default (shareable link); couple can set to private/password-protected
- Custom domain (e.g. jordanandsara.com) is a future paid feature — design slug system
  to support it without breaking changes

## When You Are Unsure
- Follow hexagonal architecture over convenience
- Choose the more testable option
- Prefer explicit over implicit
- If adding a new dependency, explain why in a comment
- Always explain the trade-off of architecture decisions
