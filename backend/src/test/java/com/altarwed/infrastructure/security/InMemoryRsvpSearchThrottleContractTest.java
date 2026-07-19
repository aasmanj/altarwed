package com.altarwed.infrastructure.security;

import com.altarwed.domain.port.RsvpSearchThrottlePort;

/**
 * Runs the {@link RsvpSearchThrottleContractTest} contract against the default in-memory
 * adapter. Complements {@link InMemoryRsvpSearchThrottleAdapterTest} (the issue-#89 invariants
 * kept verbatim): this class exists so the in-memory and Redis adapters are provably held to
 * one identical contract suite.
 */
class InMemoryRsvpSearchThrottleContractTest extends RsvpSearchThrottleContractTest {

    private final InMemoryRsvpSearchThrottleAdapter adapter = new InMemoryRsvpSearchThrottleAdapter();

    @Override
    RsvpSearchThrottlePort throttle() {
        return adapter;
    }
}
