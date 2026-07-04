# AltarWed Disaster Recovery Runbook (Azure SQL Point-in-Time Restore)

Owner: Jordan. Last reviewed: 2026-07-04.

This runbook covers recovering the AltarWed production database from Azure SQL's
built-in point-in-time restore (PITR). PITR is currently the ONLY recovery mechanism:
the prod database is single-region with no failover group and no geo-replica. Geo
redundancy is deliberately out of scope (premature per the 2026-07-03 architecture
audit); revisit when couples-shipped volume justifies the cost.

Read this top to bottom before you touch anything. In a real incident, breathe first.
Restores are additive and non-destructive: PITR always creates a NEW database and never
overwrites the live one, so you can restore, inspect, and only then decide to cut over.

## Real resource names (verified against infrastructure/ Bicep)

| Thing | Value | Source |
|---|---|---|
| Resource group | `altarwed-rg` | deploy command in `main.bicep` header (`az deployment group create --resource-group altarwed-rg`) |
| SQL logical server | `altarwed-prod-sql` | `main.bicep` (`${prefix}-sql`, prefix `altarwed-prod`) |
| Live database name | `altarwed` | `main.bicep` `databaseName: 'altarwed'` |
| Server FQDN | `altarwed-prod-sql.database.windows.net` | derived |
| Key Vault | `altarwed-prod-kv` | `main.bicep` |
| App Service (backend) | `altarwed-prod-api` | `${prefix}-api` |
| KV secret holding the JDBC URL | `AZURE-SQL-URL` | `modules/app-service.bicep` app setting `AZURE_SQL_URL` |
| KV secret holding the DB username | `AZURE-SQL-USERNAME` | `modules/app-service.bicep` |
| KV secret holding the DB password | `AZURE-SQL-PASSWORD` | `modules/app-service.bicep` |

The backend reaches SQL entirely through the `AZURE-SQL-URL` Key Vault secret (a JDBC
connection string) plus the username/password secrets. Cutover to a restored database is
therefore a single secret edit (change the `database=` segment of the JDBC URL) followed
by an App Service restart. You do NOT redeploy the JAR and you do NOT touch Bicep.

The current live JDBC URL looks like this (from `modules/sql.bicep`):

```
jdbc:sqlserver://altarwed-prod-sql.database.windows.net:1433;database=altarwed;encrypt=true;trustServerCertificate=false;loginTimeout=30
```

### Placeholder convention

Anything in `<ANGLE_BRACKETS>` is a value you fill in at run time. The rest is
copy-pasteable as written. All timestamps are UTC (Azure SQL stores `installed_on` and
takes `--time` in UTC; do not pass a local time).

## Tier note (RTO/RPO is tier-agnostic here)

The database SKU has moved between S2 and S3 (Standard tier) and PR #283 tracks that bump.
Nothing in this runbook depends on the exact Standard SKU: PITR behavior, retention, and
the restore commands are identical across S1/S2/S3/S4. The only tier-sensitive number is
restore wall-clock time, which scales with database SIZE and log volume, not with DTU tier.
Wherever a tier matters it is called out explicitly; otherwise "Standard tier" covers all of them.

---

## 1. PITR restore to a NEW database

PITR restores the live `altarwed` database as it existed at a chosen moment into a brand
new database on the same logical server. The live database is untouched.

### 1a. Confirm the restorable window

Standard tier keeps PITR backups for a retention period (Azure default is 7 days; range is
1 to 35 days). Confirm the actual earliest restore point before you pick a time:

```bash
# Earliest restorable point for the live database
az sql db show \
  --resource-group altarwed-rg \
  --server altarwed-prod-sql \
  --name altarwed \
  --query "earliestRestoreDate" -o tsv
```

If the timestamp you need is older than `earliestRestoreDate`, PITR cannot help you and
this is now a data-loss incident; escalate. (This is the argument for raising retention or
adding long-term backup retention later; not in scope for tonight.)

### 1b. Restore

Pick a UTC restore time and a scratch destination name. Convention: `altarwed-restore-<UTCDATE>`
so it is obvious what it is and when it was made.

```bash
# Restore the live DB as of a specific UTC instant into a NEW database
az sql db restore \
  --resource-group altarwed-rg \
  --server altarwed-prod-sql \
  --name altarwed \
  --dest-name <NEW_DB_NAME> \
  --time "<RESTORE_TIME_UTC>"     # e.g. 2026-07-04T12:30:00Z
```

Notes:
- `--name altarwed` is the SOURCE (live) database. `--dest-name` is the new database.
- The restored database lands on the SAME server (`altarwed-prod-sql`) with the same admin
  login, so the existing `AZURE-SQL-USERNAME` / `AZURE-SQL-PASSWORD` secrets already work
  against it. Only the `database=` segment of the JDBC URL differs.
- The command blocks until the restore completes and can take a while (see RTO below).
- The restored DB is created at the server's default SKU. If it needs to carry prod load,
  set its tier to match live after the restore:

```bash
# Optional: match the restored DB to the live tier before cutover
# (<TIER> / <SKU> tier-agnostic: read the live values first, then apply the same)
az sql db show -g altarwed-rg -s altarwed-prod-sql -n altarwed \
  --query "{sku:currentServiceObjectiveName, tier:currentSku.tier}" -o json

az sql db update -g altarwed-rg -s altarwed-prod-sql -n <NEW_DB_NAME> \
  --service-objective <SKU>      # e.g. S3
```

### 1c. Sanity-check the restored database BEFORE cutover

Query the restored copy to confirm it holds the data you expect (row counts, the last
known-good record, the Flyway history). Connect with sqlcmd or any client using the
`altarwed-prod-sql.database.windows.net` server, database `<NEW_DB_NAME>`, and the admin
credentials from Key Vault:

```bash
# Read the admin login for a manual connection (do NOT paste these into logs/tickets)
az keyvault secret show --vault-name altarwed-prod-kv --name AZURE-SQL-USERNAME --query value -o tsv
az keyvault secret show --vault-name altarwed-prod-kv --name AZURE-SQL-PASSWORD --query value -o tsv
```

Example sanity query (run against `<NEW_DB_NAME>`):

```sql
SELECT COUNT(*) AS couples FROM couples;
SELECT TOP 5 version, description, installed_on, success
FROM flyway_schema_history ORDER BY installed_rank DESC;
```

Only proceed to cutover once the restored copy looks right.

---

## 2. Cutover (repoint prod at the restored database)

Cutover is: (a) point the `AZURE-SQL-URL` secret at the new database, (b) restart the App
Service so it re-resolves the Key Vault reference and reopens its HikariCP pool against the
new database.

### 2a. Swap the connection string in Key Vault

The only change to the JDBC URL is the `database=<name>` segment. Set a new version of the
`AZURE-SQL-URL` secret:

```bash
az keyvault secret set \
  --vault-name altarwed-prod-kv \
  --name AZURE-SQL-URL \
  --value "jdbc:sqlserver://altarwed-prod-sql.database.windows.net:1433;database=<NEW_DB_NAME>;encrypt=true;trustServerCertificate=false;loginTimeout=30"
```

Key Vault keeps every prior version, so the OLD connection string is your instant rollback:
re-set the secret with `database=altarwed` (or the previous good DB) to roll back.

### 2b. Force the App Service to pick up the new secret

App Service caches Key Vault references and only guarantees re-resolution on an app-settings
CHANGE or after the ~24h cache expiry, NOT on a bare restart. So the reliable primary step is
to write an app setting (which re-syncs ALL Key Vault references) and then restart to cycle
the HikariCP pool against the new database:

```bash
# PRIMARY: write an app setting to force KV-reference re-resolution, then restart
az webapp config appsettings set -g altarwed-rg -n altarwed-prod-api \
  --settings DR_CUTOVER_TS="<RESTORE_TIME_UTC>"
az webapp restart -g altarwed-rg -n altarwed-prod-api
```

`DR_CUTOVER_TS` is a harmless marker setting the app ignores; its only job is to change the
config so the platform re-fetches every `@Microsoft.KeyVault(...)` reference, including
`AZURE-SQL-URL`. Setting it to the restore instant also leaves an audit trail of the cutover.

Secondary (only if you have separately confirmed the KV reference already refreshed, for
example the 24h cache has rolled): a bare restart cycles the pool without re-touching config:

```bash
# SECONDARY: bare restart, only when the reference is known-current
az webapp restart --resource-group altarwed-rg --name altarwed-prod-api
```

Staging slot: a staging deployment slot is NOT part of the infrastructure on `main`; it is
staged in open PR #283 and exists only after that Bicep is applied. If the staging slot from
PR #283 has been applied AND is currently serving prod traffic (post-swap), also force-refresh
and restart it (it shares the same `AZURE-SQL-URL` secret, so it picks up the same new database):

```bash
# Only if the PR #283 staging slot has been applied and is live
az webapp config appsettings set -g altarwed-rg -n altarwed-prod-api --slot staging \
  --settings DR_CUTOVER_TS="<RESTORE_TIME_UTC>"
az webapp restart --resource-group altarwed-rg --name altarwed-prod-api --slot staging
```

### 2c. Verify

```bash
# Backend health should return 200 once the pool is up against the new DB
curl -fsS https://altarwed-prod-api.azurewebsites.net/actuator/health
```

Then load `https://altarwed.com/wedding/<jordan-slug>` and confirm the site renders and
recent writes (RSVPs, guest edits) reflect the restored point in time.

---

## 3. Expected RTO / RPO (Standard tier PITR)

These are honest ranges, not marketing numbers. State the assumptions when you report them.

### RPO (how much data you can lose)

- Azure SQL takes continuous backups: full weekly, differential every ~12-24h, and
  transaction-log backups every ~5-10 minutes.
- If you restore to the LATEST restorable point, worst-case data loss is roughly the gap to
  the last log backup: about **5 to 10 minutes**.
- If you restore to a chosen earlier time (for example just before a bad migration), the
  "loss" is deliberate and equals live-now minus your chosen time; that is the point.
- Assumption: this is single-region PITR only. A full Azure regional outage that takes the
  server offline is NOT covered by PITR (no geo-replica). RPO in that scenario is undefined
  and is the explicit trade-off of the current single-region design.

### RTO (how long recovery takes)

RTO is dominated by restore wall-clock time, which scales with database SIZE and log
replay, NOT with the DTU tier (S2 vs S3 does not change this). For AltarWed today the
database is small (media lives in Blob, not SQL; storage ceiling is 250 GB but actual size
is a few GB), so:

- Restore of a small (single-digit GB) database: typically **minutes to ~30 minutes**.
- Larger databases or heavy log replay to a precise mid-day point: **up to a few hours**.
- Add cutover overhead on top: secret swap + restart + pool warm-up + health verify is
  about **5 to 10 minutes**.

Honest end-to-end RTO for a typical AltarWed PITR today: **roughly 20 to 45 minutes**,
assuming a small DB and that someone is at the keyboard running these commands. Budget
longer if the DB has grown, if you must resize the restored DB to the prod tier first, or
if the incident starts with time spent diagnosing.

To sharpen these numbers, measure the actual restore duration during the quarterly drill
(section 5) and update this section with real observed times.

---

## 4. Bad-Flyway-migration playbook

Scenario: a migration (`V{N}__*.sql`) ran against prod and corrupted or destroyed data
(dropped a column, bad backfill, wrong `UPDATE`). Flyway migrations are irreversible and
you must NEVER edit an already-applied migration. Recovery is: restore to a point BEFORE the
bad migration ran, cut over, then fix forward with a NEW migration.

### 4a. Find the exact time the bad migration ran

`flyway_schema_history.installed_on` is the authoritative timestamp (UTC on Azure SQL).
Query the LIVE database (or the restored copy) to find it:

```sql
SELECT installed_rank, version, description, installed_on, success
FROM flyway_schema_history
ORDER BY installed_rank DESC;
```

Identify the offending `version` (for example `V47`) and read its `installed_on`. That is
the instant the migration committed.

### 4b. Restore to just BEFORE that instant

Pick a restore time a minute or two before `installed_on` so the migration's transaction is
excluded, then run the section 1 restore with that `--time`:

```bash
az sql db restore \
  --resource-group altarwed-rg \
  --server altarwed-prod-sql \
  --name altarwed \
  --dest-name <NEW_DB_NAME> \
  --time "<INSTALLED_ON_MINUS_2_MIN_UTC>"
```

Sanity-check (section 1c): the restored `flyway_schema_history` should NOT contain the bad
version, and the damaged data should be intact. Then cut over (section 2).

### 4c. Fix forward (never edit the applied migration)

After cutover, the live database is at a schema version BEFORE the bad migration. The bad
`V{N}` file still exists in the repo and Flyway will try to run it again on next deploy.
Do NOT edit `V{N}` in place (that breaks Flyway's checksum for anyone who already ran it and
violates the house rule that applied migrations are immutable). Instead:

1. Leave `V{N}` untouched and express the corrected end-state in a NEW migration `V{N+1}`.
   After the restore, prod's `flyway_schema_history` no longer contains `V{N}`, so `V{N}` will
   re-run on the next deploy exactly as written. Do NOT edit `V{N}` to "fix" or no-op it:
   - If the migration was simply wrong and unwanted: add `V{N+1}__revert_or_supersede_bad_change.sql`
     that is safe and idempotent and reverses or supersedes what `V{N}` does.
   - If the intent was right but the SQL was buggy: add `V{N+1}__*.sql` that achieves the
     intended change safely.
   Either way the fix is always a forward migration, never an edit to `V{N}`.
2. Because the restored DB may already carry a partial `V{N}` row (if the failure was
   partway), verify `flyway_schema_history` after cutover and confirm the next deploy's
   Flyway plan is what you expect. If Flyway reports a checksum mismatch or a failed
   migration row, resolve it with a deliberate, reviewed `flyway repair` step, not by editing
   history ad hoc. Treat any `flyway repair` as human-only and reviewed.
3. Open a follow-up issue documenting the incident and the corrective migration.

The golden rule: restore fixes the DATA; a new forward migration fixes the SCHEMA. Neither
one edits an already-applied migration file.

---

## 5. Quarterly restore-drill checklist (about 15 minutes)

Run this every quarter so the restore path is proven and the RTO numbers stay honest. This
drill is non-destructive: it restores to a throwaway scratch database and deletes it. It
never touches the live database or the `AZURE-SQL-URL` secret.

- [ ] Note the start time (you are measuring RTO).
- [ ] Confirm the restore window:
      `az sql db show -g altarwed-rg -s altarwed-prod-sql -n altarwed --query earliestRestoreDate -o tsv`
- [ ] Restore to a scratch DB (latest point is fine for a drill):

      ```bash
      az sql db restore -g altarwed-rg -s altarwed-prod-sql -n altarwed \
        --dest-name altarwed-drill-<UTCDATE> \
        --time "<RESTORE_TIME_UTC>"
      ```

- [ ] Record how long the restore took (update section 3 if it drifts).
- [ ] Sanity query against the scratch DB (must return sane counts):

      ```sql
      SELECT COUNT(*) AS couples FROM couples;
      SELECT TOP 1 version, installed_on FROM flyway_schema_history ORDER BY installed_rank DESC;
      ```

- [ ] Delete the scratch DB (do NOT skip; a stray Standard DB bills continuously):

      ```bash
      az sql db delete -g altarwed-rg -s altarwed-prod-sql -n altarwed-drill-<UTCDATE> --yes
      ```

- [ ] Confirm deletion:
      `az sql db list -g altarwed-rg -s altarwed-prod-sql --query "[].name" -o tsv`
- [ ] Note the end time; the delta is your practiced RTO. Log it in the issue tracker.

If any step fails or is slower than section 3 claims, fix the runbook (or the config) before
the next incident finds the gap for you.

---

## Rollback summary (keep this handy)

- Cutover is reversible: re-set `AZURE-SQL-URL` to the previous JDBC URL (Key Vault keeps
  old versions) and restart `altarwed-prod-api`.
- The live `altarwed` database is never overwritten by a restore, so aborting a cutover
  just means pointing back at `altarwed` and deleting the restored copy.
- Delete abandoned restore/scratch databases promptly; each one bills as a full Standard DB.
