package com.altarwed.infrastructure.sharedstate;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Conditional;
import org.springframework.context.annotation.Profile;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * One aggregate WARN at prod startup when the shared-state stores are running in-memory
 * (issues #109/#414), following the {@code StartupConfigValidator} pattern: the condition is
 * not fatal, the app is healthy at capacity 1, but scaling out silently multiplies every rate
 * limit by the instance count and breaks OAuth callbacks that land on the wrong instance, so
 * it must be visible in App Insights rather than living only in a code comment.
 *
 * <p>The actual App Service instance count is not observable from inside a single instance
 * (Azure exposes this instance's WEBSITE_INSTANCE_ID, never the count), so the WARN fires
 * whenever prod runs without Redis instead of only "at capacity > 1". Gated to the prod
 * profile because locally and in CI Redis is normally absent by design, and warning there is
 * warning fatigue (observability rule 12).
 */
@Component
@Profile("prod")
@Conditional(RedisNotConfiguredCondition.class)
public class SharedStateStartupLogger {

    private static final Logger log = LoggerFactory.getLogger(SharedStateStartupLogger.class);

    @EventListener(ApplicationReadyEvent.class)
    public void warnSharedStateIsPerInstance() {
        log.warn("shared state running in-memory, REDIS_URL unset; ip rate limits, rsvp search throttle "
                + "and oauth state are per instance, keep App Service capacity at 1 until Redis is "
                + "configured (issues #109/#414)");
    }
}
