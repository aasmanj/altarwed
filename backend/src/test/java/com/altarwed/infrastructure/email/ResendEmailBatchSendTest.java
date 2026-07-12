package com.altarwed.infrastructure.email;

import com.altarwed.domain.model.RsvpInviteRecipient;
import com.altarwed.domain.port.EmailSuppressionPort;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.ExpectedCount;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

/**
 * Verifies the scale fix in issue #378: bulk RSVP invites are fanned out through Resend's
 * /emails/batch endpoint in chunks of 100, not one API call per guest, and a transient 429
 * (rate-limit) is retried with backoff rather than dropped.
 *
 * These tests bind a {@link MockRestServiceServer} to the adapter's RestClient via the
 * package-private test-seam constructor, so batching and backoff are asserted against a mocked
 * HTTP layer without a live Resend call.
 */
class ResendEmailBatchSendTest {

    private static final String BATCH_URL = "https://api.resend.com/emails/batch";

    private static EmailSuppressionPort noopSuppression() {
        // The RSVP batch path never consults the suppression port (opt-out is enforced in
        // GuestService before minting tokens), so a no-op stub is sufficient here.
        return new EmailSuppressionPort() {
            @Override public boolean isSuppressed(String emailHash) { return false; }
            @Override public void suppress(String emailHash, String source) { }
            @Override public Optional<String> suppressionSource(String emailHash) { return Optional.empty(); }
            @Override public Map<String, String> suppressionSources(Collection<String> emailHashes) { return Collections.emptyMap(); }
            @Override public boolean clearLegacyUserRequest(String emailHash) { return false; }
        };
    }

    private ResendEmailAdapter adapterBoundTo(MockRestServiceServer[] serverOut, int ratePerSecond) {
        RestClient.Builder builder = RestClient.builder().baseUrl("https://api.resend.com");
        serverOut[0] = MockRestServiceServer.bindTo(builder).build();
        RestClient client = builder.build();
        return new ResendEmailAdapter(
                client,
                "hello@altarwed.com",
                "hello@invites.altarwed.com",
                "https://app.altarwed.com",
                "https://api.altarwed.com",
                "unsubscribe-signing-secret",
                "AltarWed, 123 Chapel Lane, Suite 4, Portland OR 97201",
                "admin@altarwed.com",
                ratePerSecond,
                noopSuppression()
        );
    }

    private static List<RsvpInviteRecipient> recipients(int count) {
        List<RsvpInviteRecipient> list = new ArrayList<>(count);
        for (int i = 0; i < count; i++) {
            list.add(new RsvpInviteRecipient(
                    "guest" + i + "@example.com", "Guest " + i, UUID.randomUUID(), "tok-" + i));
        }
        return list;
    }

    @Test
    void bulkInvites_areChunkedIntoBatchCalls_of100() {
        MockRestServiceServer[] serverOut = new MockRestServiceServer[1];
        // High rate ceiling so the three batch tokens are granted without blocking the test.
        ResendEmailAdapter adapter = adapterBoundTo(serverOut, 1000);
        MockRestServiceServer server = serverOut[0];

        // 250 recipients must become exactly ceil(250 / 100) = 3 POSTs to /emails/batch,
        // not 250 individual /emails calls.
        server.expect(ExpectedCount.times(3), requestTo(BATCH_URL))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));

        adapter.sendRsvpInviteEmails(recipients(250), UUID.randomUUID(),
                "Alex & Jordan", "October 3, 2026", "couple@example.com");

        // verify() fails if fewer or more than 3 batch calls were made.
        server.verify();
    }

    @Test
    void exactlyOneFullChunk_isASingleBatchCall() {
        MockRestServiceServer[] serverOut = new MockRestServiceServer[1];
        ResendEmailAdapter adapter = adapterBoundTo(serverOut, 1000);
        MockRestServiceServer server = serverOut[0];

        // 100 recipients (the batch ceiling) is a single call, proving we never split a full chunk.
        server.expect(ExpectedCount.times(1), requestTo(BATCH_URL))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));

        adapter.sendRsvpInviteEmails(recipients(100), UUID.randomUUID(),
                "Alex & Jordan", "October 3, 2026", "couple@example.com");

        server.verify();
    }

    @Test
    void transientRateLimit_isRetriedWithBackoff_thenSucceeds() {
        MockRestServiceServer[] serverOut = new MockRestServiceServer[1];
        ResendEmailAdapter adapter = adapterBoundTo(serverOut, 1000);
        MockRestServiceServer server = serverOut[0];

        // First batch call is rate-limited (429 with no "quota" marker, so it is transient);
        // the adapter must back off and retry, and the retry succeeds. Expectations are matched
        // in declared order, so the second POST is the retry.
        server.expect(ExpectedCount.once(), requestTo(BATCH_URL))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS));
        server.expect(ExpectedCount.once(), requestTo(BATCH_URL))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));

        assertThatCode(() -> adapter.sendRsvpInviteEmails(recipients(3), UUID.randomUUID(),
                "Alex & Jordan", "October 3, 2026", "couple@example.com"))
                .doesNotThrowAnyException();

        // Both the initial 429 and the successful retry were issued.
        server.verify();
    }
}
