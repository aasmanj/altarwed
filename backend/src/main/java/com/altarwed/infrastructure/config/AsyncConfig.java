package com.altarwed.infrastructure.config;

import com.altarwed.infrastructure.observability.MdcTaskDecorator;
import net.javacrumbs.shedlock.core.LockProvider;
import net.javacrumbs.shedlock.provider.jdbctemplate.JdbcTemplateLockProvider;
import net.javacrumbs.shedlock.spring.annotation.EnableSchedulerLock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import javax.sql.DataSource;
import java.util.concurrent.Executor;

@Configuration
@EnableAsync
@EnableScheduling
// Issue #44: default ceiling for how long any @SchedulerLock-annotated job may hold its
// lock before ShedLock considers it dead and lets another instance take over, even if that
// instance crashed mid-run. Each job overrides this with its own tighter lockAtMostFor.
@EnableSchedulerLock(defaultLockAtMostFor = "15m")
public class AsyncConfig {

    @Bean(name = "emailExecutor")
    public Executor emailExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(4);
        executor.setMaxPoolSize(10);
        executor.setQueueCapacity(200);
        executor.setThreadNamePrefix("email-");
        // CallerRunsPolicy: if queue is full, the calling thread sends the email
        // synchronously rather than dropping it. Never lose an email silently.
        executor.setRejectedExecutionHandler(new java.util.concurrent.ThreadPoolExecutor.CallerRunsPolicy());
        // Propagate SLF4J MDC (requestId, userId) into the email thread so async
        // logs can be correlated back to the HTTP request that triggered them.
        executor.setTaskDecorator(new MdcTaskDecorator());
        executor.initialize();
        return executor;
    }

    // Backs the shedlock table (V82 migration) with the same DataSource as everything else,
    // so a lock row commits/rolls back in step with the app's normal SQL Server connection pool
    // rather than opening a second one. usingDbTime() reads "now" from SQL Server, not the app
    // instance's clock, so lock expiry can't drift across instances with clock skew.
    @Bean
    public LockProvider lockProvider(DataSource dataSource) {
        return new JdbcTemplateLockProvider(
                JdbcTemplateLockProvider.Configuration.builder()
                        .withJdbcTemplate(new JdbcTemplate(dataSource))
                        .usingDbTime()
                        .build()
        );
    }
}
