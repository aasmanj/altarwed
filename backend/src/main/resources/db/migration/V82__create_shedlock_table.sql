-- Issue #44: backs ShedLock, the distributed lock that stops @Scheduled pollers
-- (RsvpReminderService, GoogleSheetPollingJob) from double-firing once App Service
-- scales past one instance. Schema is ShedLock's own fixed contract (see
-- net.javacrumbs.shedlock JdbcTemplateLockProvider docs), not an AltarWed domain
-- table, so it intentionally does not follow the UUID-primary-key convention.
CREATE TABLE shedlock (
    name       VARCHAR(64)  NOT NULL CONSTRAINT pk_shedlock PRIMARY KEY,
    lock_until DATETIME2    NOT NULL,
    locked_at  DATETIME2    NOT NULL,
    locked_by  VARCHAR(255) NOT NULL
);
