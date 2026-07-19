package com.altarwed.infrastructure.sharedstate;

import org.springframework.context.annotation.Condition;
import org.springframework.context.annotation.ConditionContext;
import org.springframework.core.type.AnnotatedTypeMetadata;
import org.springframework.util.StringUtils;

/**
 * Matches when {@code altarwed.redis.url} (env var {@code REDIS_URL}) is set to a non-blank
 * value. Gates every Redis-backed shared-state bean (issues #109/#414), so the app has zero
 * Redis dependency, at build, boot, and runtime, until the operator explicitly opts in.
 *
 * <p>A custom {@link Condition} rather than {@code @ConditionalOnProperty} because the latter
 * can only compare against a fixed value; the contract here is "non-blank", since the property
 * always exists with an empty default (the safe-default env-var rule in backend/CLAUDE.md).
 */
public class RedisConfiguredCondition implements Condition {

    static final String REDIS_URL_PROPERTY = "altarwed.redis.url";

    @Override
    public boolean matches(ConditionContext context, AnnotatedTypeMetadata metadata) {
        return StringUtils.hasText(context.getEnvironment().getProperty(REDIS_URL_PROPERTY));
    }
}
