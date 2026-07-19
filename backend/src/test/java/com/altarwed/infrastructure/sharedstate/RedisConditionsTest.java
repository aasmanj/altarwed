package com.altarwed.infrastructure.sharedstate;

import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.ConditionContext;
import org.springframework.mock.env.MockEnvironment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * The bean-selection switch for issues #109/#414 in isolation: exactly one implementation of
 * each shared store must activate, chosen by whether {@code altarwed.redis.url} has text. The
 * blank and missing cases matter most, they are the "no Redis provisioned" default, and both
 * conditions being complementary is what guarantees the context never has zero or two
 * implementations of a port.
 */
class RedisConditionsTest {

    private static ConditionContext contextWithProperty(String value) {
        MockEnvironment environment = new MockEnvironment();
        if (value != null) {
            environment.setProperty(RedisConfiguredCondition.REDIS_URL_PROPERTY, value);
        }
        ConditionContext context = mock(ConditionContext.class);
        when(context.getEnvironment()).thenReturn(environment);
        return context;
    }

    @Test
    void missingUrlSelectsInMemory() {
        ConditionContext context = contextWithProperty(null);
        assertThat(new RedisConfiguredCondition().matches(context, null)).isFalse();
        assertThat(new RedisNotConfiguredCondition().matches(context, null)).isTrue();
    }

    @Test
    void blankUrlSelectsInMemory() {
        // The env-var contract sets REDIS_URL to empty (not absent) by default, so blank is
        // the exact value prod runs with until a cache is provisioned.
        ConditionContext context = contextWithProperty("  ");
        assertThat(new RedisConfiguredCondition().matches(context, null)).isFalse();
        assertThat(new RedisNotConfiguredCondition().matches(context, null)).isTrue();
    }

    @Test
    void realUrlSelectsRedis() {
        ConditionContext context = contextWithProperty("rediss://:key@cache.redis.cache.windows.net:6380/0");
        assertThat(new RedisConfiguredCondition().matches(context, null)).isTrue();
        assertThat(new RedisNotConfiguredCondition().matches(context, null)).isFalse();
    }
}
