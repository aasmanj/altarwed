
# AltarWed — AI Assistant Instructions

## What We Are Building
AltarWed is a faith-first Christian wedding planning platform — a 
two-sided marketplace connecting engaged Christian couples with 
faith-aligned wedding vendors. Think The Knot, but built for Christian 
couples with covenant, scripture, and denomination at the center.

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
- Couple (UUID id, partnerOneName, partnerTwoName, email, weddingDate, denominationId)
- Vendor (UUID id, businessName, category, city, state, isChristianOwned, denominationIds)
- Ceremony (UUID id, coupleId, denomination, scriptureVerses, vowText, orderOfService)
- Guest (UUID id, coupleId, name, email, rsvpStatus, dietaryRestrictions)
- Denomination (UUID id, name, slug, traditions)
- VendorSubscription (UUID id, vendorId, planTier, status, renewalDate)
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

## When You Are Unsure
- Follow hexagonal architecture over convenience
- Choose the more testable option
- Prefer explicit over implicit
- If adding a new dependency, explain why in a comment
- Always explain the trade-off of architecture decisions
