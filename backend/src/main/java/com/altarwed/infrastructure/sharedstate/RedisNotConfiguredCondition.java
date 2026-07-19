package com.altarwed.infrastructure.sharedstate;

import org.springframework.context.annotation.Condition;
import org.springframework.context.annotation.ConditionContext;
import org.springframework.core.type.AnnotatedTypeMetadata;

/**
 * Exact negation of {@link RedisConfiguredCondition}: matches when {@code altarwed.redis.url}
 * is absent or blank. Gates the in-memory shared-state beans so exactly one implementation of
 * each store exists in the context, selected deterministically at startup. Two explicit
 * conditions (rather than {@code @ConditionalOnMissingBean}) avoid any dependence on bean
 * registration order.
 */
public class RedisNotConfiguredCondition implements Condition {

    @Override
    public boolean matches(ConditionContext context, AnnotatedTypeMetadata metadata) {
        return !new RedisConfiguredCondition().matches(context, metadata);
    }
}
