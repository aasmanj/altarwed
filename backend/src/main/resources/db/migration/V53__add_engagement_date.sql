-- Engagement date for couples, used to scale the planning checklist timeline
-- into the couple's actual runway (engagement -> wedding) instead of assuming a
-- fixed 12-month engagement. Nullable: existing couples and couples who skip it
-- fall back to account creation date, then to the legacy fixed behavior.
ALTER TABLE wedding_websites ADD engagement_date DATE NULL;
