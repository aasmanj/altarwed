
# Backend — AltarWed API

## Quick Start
- Run: ./gradlew bootRun
- Test: ./gradlew test
- Build: ./gradlew build
- New migration: create V{N+1}__{description}.sql in src/main/resources/db/migration/

## Key Files
- build.gradle.kts → all dependencies
- application.yml → config (no secrets here — use env vars or Key Vault)
- AltarWedApplication.java → main entry point

## Current Entities (Phase 1)
Couple, Vendor, Denomination — start here

## Auth Flow
1. POST /api/v1/auth/register → creates Couple, returns 201
2. POST /api/v1/auth/login → validates credentials, returns accessToken + refreshToken
3. POST /api/v1/auth/refresh → validates refreshToken, returns new accessToken
4. Authorization: Bearer {accessToken} on all protected requests

## Package Import Rules (repeat because it matters)
domain → imports nothing from this project
application → imports domain only
infrastructure → imports domain + application
web → imports application + domain DTOs only
