package com.altarwed.infrastructure.observability;

import org.slf4j.MDC;
import org.springframework.core.task.TaskDecorator;

import java.util.Map;

/**
 * Propagates SLF4J MDC across @Async / executor boundaries.
 *
 * MDC is thread-local. When a method is annotated @Async, Spring submits the
 * Runnable to an executor, which runs it on a different thread that has a
 * fresh empty MDC. That means correlation IDs (requestId, userId) silently
 * disappear from async log lines unless we explicitly carry them over.
 *
 * This decorator captures the caller's MDC at submit time, replays it on the
 * executor thread for the duration of the task, then restores the executor
 * thread's prior MDC to keep pool threads clean for the next task.
 *
 * Wired in AsyncConfig.emailExecutor() via setTaskDecorator(...).
 */
public class MdcTaskDecorator implements TaskDecorator {

    @Override
    public Runnable decorate(Runnable runnable) {
        Map<String, String> captured = MDC.getCopyOfContextMap();
        return () -> {
            Map<String, String> previous = MDC.getCopyOfContextMap();
            if (captured != null) MDC.setContextMap(captured);
            else MDC.clear();
            try {
                runnable.run();
            } finally {
                if (previous != null) MDC.setContextMap(previous);
                else MDC.clear();
            }
        };
    }
}
