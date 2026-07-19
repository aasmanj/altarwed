package com.altarwed.application.service;

import com.altarwed.application.dto.SendInquiryRequest;
import com.altarwed.domain.exception.CaptchaVerificationFailedException;
import com.altarwed.domain.exception.InquiryThrottledException;
import com.altarwed.domain.exception.VendorNotFoundException;
import com.altarwed.domain.model.Inquiry;
import com.altarwed.domain.model.Vendor;
import com.altarwed.domain.model.VendorCategory;
import com.altarwed.domain.port.CaptchaVerificationPort;
import com.altarwed.domain.port.InquiryRepository;
import com.altarwed.domain.port.InquiryThrottlePort;
import com.altarwed.infrastructure.security.InMemoryInquiryThrottleAdapter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Issue #100: the public inquiry endpoint queues two emails per accepted call, so
 * it is an email-flood vector. These tests pin the gate ordering (captcha, then
 * vendor resolution, then per-vendor cap) and, above all, that NOTHING is
 * persisted and NO email is queued when any gate rejects.
 */
@ExtendWith(MockitoExtension.class)
class VendorInquiryServiceTest {

    private static final String REMOTE_IP = "203.0.113.7";

    // Mirrors InMemoryInquiryThrottleAdapter.INQUIRY_BUDGET (package-private, not visible from
    // this package), same idiom as GuestServiceTest's SEARCH_BUDGET mirror. If the cap changes,
    // this test fails loudly rather than silently testing the wrong boundary.
    private static final int INQUIRY_BUDGET = 20;

    @Mock private VendorService vendorService;
    @Mock private AsyncEmailService emails;
    @Mock private InquiryRepository inquiryRepository;
    @Mock private CaptchaVerificationPort captchaVerificationPort;
    @Mock private InquiryThrottlePort inquiryThrottlePort;

    private final UUID vendorId = UUID.randomUUID();

    @BeforeEach
    void humanByDefault() {
        // Default every test to a "human verified" captcha result; tests that care
        // about captcha rejection override this explicitly. Lenient because the
        // captcha-rejection test replaces the stub entirely.
        lenient().when(captchaVerificationPort.verify(any(), any())).thenReturn(true);
        lenient().when(inquiryThrottlePort.tryAcquire(anyString())).thenReturn(true);
    }

    private VendorInquiryService service() {
        return new VendorInquiryService(vendorService, emails, inquiryRepository,
                captchaVerificationPort, inquiryThrottlePort, "https://altarwed.com");
    }

    private Vendor vendor(boolean active) {
        return new Vendor(vendorId, "Graceful Blooms", VendorCategory.FLORIST, "Austin", "TX",
                "login@gracefulblooms.example", "hash", true, List.of(), active, true, "$$",
                null, null, null, null, null, 0, "hello@gracefulblooms.example",
                LocalDateTime.now(), LocalDateTime.now());
    }

    private SendInquiryRequest request() {
        return new SendInquiryRequest(vendorId, "Jordan & Eden", "couple@example.com",
                "October 2026", "We would love to learn about your availability.", "tok_live");
    }

    @Test
    void validTokenUnderCapPersistsAndSendsBothEmails() {
        when(vendorService.getById(vendorId)).thenReturn(vendor(true));

        service().send(request(), REMOTE_IP);

        ArgumentCaptor<Inquiry> saved = ArgumentCaptor.forClass(Inquiry.class);
        verify(inquiryRepository).save(saved.capture());
        assertThat(saved.getValue().vendorId()).isEqualTo(vendorId);

        // Notification goes to the public contactEmail when set, not the login email.
        verify(emails).sendVendorInquiryEmail(
                org.mockito.ArgumentMatchers.eq("hello@gracefulblooms.example"),
                any(), any(), any(), any(), any(), any());
        verify(emails).sendVendorInquiryConfirmation(any(), any(), any(), any());
        verify(inquiryThrottlePort).tryAcquire(vendorId.toString());
    }

    @Test
    void invalidCaptchaTokenRejectsBeforeAnyWorkAndSendsNothing() {
        when(captchaVerificationPort.verify(any(), any())).thenReturn(false);

        assertThatThrownBy(() -> service().send(request(), REMOTE_IP))
                .isInstanceOf(CaptchaVerificationFailedException.class);

        // Captcha is the first gate: no vendor lookup, no persistence, no email, and
        // critically no throttle charge (bots must not burn a vendor's real budget).
        verifyNoInteractions(vendorService, inquiryRepository, emails, inquiryThrottlePort);
    }

    @Test
    void overCapReturns429PathAndSendsNoEmail() {
        when(vendorService.getById(vendorId)).thenReturn(vendor(true));
        when(inquiryThrottlePort.tryAcquire(vendorId.toString())).thenReturn(false);

        assertThatThrownBy(() -> service().send(request(), REMOTE_IP))
                .isInstanceOf(InquiryThrottledException.class);

        verifyNoInteractions(inquiryRepository, emails);
    }

    @Test
    void inactiveVendorStillRejectsWithoutEmailAndWithoutChargingTheCap() {
        when(vendorService.getById(vendorId)).thenReturn(vendor(false));

        assertThatThrownBy(() -> service().send(request(), REMOTE_IP))
                .isInstanceOf(VendorNotFoundException.class);

        verifyNoInteractions(inquiryRepository, emails);
        verify(inquiryThrottlePort, never()).tryAcquire(anyString());
    }

    @Test
    void capIsPerVendorNotGlobal_realAdapterEndToEnd() {
        // Wire the REAL in-memory adapter (not a mock) through the service to prove the
        // per-vendor isolation property end to end: exhausting vendor A's budget keeps
        // rejecting A (no email) while vendor B still accepts and emails normally.
        var realThrottle = new InMemoryInquiryThrottleAdapter();
        var svc = new VendorInquiryService(vendorService, emails, inquiryRepository,
                captchaVerificationPort, realThrottle, "https://altarwed.com");

        UUID vendorB = UUID.randomUUID();
        Vendor a = vendor(true);
        Vendor b = new Vendor(vendorB, "Cornerstone Catering", VendorCategory.CATERER, "Waco", "TX",
                "login@cornerstone.example", "hash", true, List.of(), true, true, "$$",
                null, null, null, null, null, 0, null,
                LocalDateTime.now(), LocalDateTime.now());
        when(vendorService.getById(vendorId)).thenReturn(a);
        when(vendorService.getById(vendorB)).thenReturn(b);

        for (int i = 0; i < INQUIRY_BUDGET; i++) {
            svc.send(request(), REMOTE_IP);
        }

        assertThatThrownBy(() -> svc.send(request(), REMOTE_IP))
                .isInstanceOf(InquiryThrottledException.class);

        // Vendor B is untouched by vendor A's exhausted budget.
        var toB = new SendInquiryRequest(vendorB, "Sam & Alex", "samalex@example.com",
                null, "Do you cater weddings of around 120 guests?", "tok_live");
        svc.send(toB, REMOTE_IP);

        // Budget emails: A got exactly INQUIRY_BUDGET notifications (none for the
        // rejected 21st), B got exactly one. contactEmail null for B falls back to
        // the login email.
        verify(emails, org.mockito.Mockito.times(INQUIRY_BUDGET))
                .sendVendorInquiryEmail(
                        org.mockito.ArgumentMatchers.eq("hello@gracefulblooms.example"),
                        any(), any(), any(), any(), any(), any());
        verify(emails).sendVendorInquiryEmail(
                org.mockito.ArgumentMatchers.eq("login@cornerstone.example"),
                any(), any(), any(), any(), any(), any());
    }
}
