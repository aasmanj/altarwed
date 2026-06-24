<!-- AltarWed PR template. Agents and humans both use this. No em dashes anywhere. -->

## What and why
<!-- One or two sentences. What changed and which issue/metric it serves. -->

Closes #

## How it was verified
<!-- Required. Name the CI-runnable test(s) you added and what they assert. -->
<!-- If a behavioral check needs the local Docker stack (verifier-api/verifier-web), say so; this PR stays a DRAFT until Jordan verifies locally. -->

- [ ] Added a test that fails before the change and passes after
- [ ] CI is green (migration-filenames, backend-test, schema-validate, frontend-public-build, frontend-app-build)

## Safety checklist
- [ ] No secrets, API keys, or connection strings added (Key Vault only)
- [ ] Hexagonal dependency rule respected (no Spring/JPA/infra imports in `domain`)
- [ ] DTO records use boxed types (`Integer`, not `int`)
- [ ] Schema changes have a Flyway migration; no `ddl-auto=create/update`
- [ ] No em dashes (UI copy, comments, commit message, this PR)
- [ ] This change does NOT touch secrets / infra / auth / migrations / payments, OR it is opened as a DRAFT for Jordan

## Merge mode
<!-- Default is DRAFT (Jordan merges). Only plain-docs PRs (never .claude/.github/CLAUDE.md) may auto-merge. -->
- [ ] DRAFT (default; Jordan reviews and merges)
- [ ] Ready for auto-merge (plain docs only: `*.md` / `docs/`, no policy/CI/runtime files)
