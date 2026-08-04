package com.altarwed.application.service;

import com.altarwed.domain.model.Vendor;
import com.altarwed.domain.model.VendorCategory;
import com.altarwed.domain.port.EmailSuppressionPort;
import com.altarwed.domain.port.VendorListingNudgeRepository;
import com.altarwed.domain.port.VendorPortfolioPhotoRepository;
import com.altarwed.domain.port.VendorRepository;
import net.javacrumbs.shedlock.core.LockAssert;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link VendorListingNudgeService}, the one-time day-3 vendor listing-completion
 * nudge (issue #557). The real {@link VendorListingNudgeSender} is wired in so the assertions
 * cover the whole flow (receipt insert + outbox enqueue); only the leaf ports are mocked.
 *
 * Each case pins one acceptance criterion:
 *   - an incomplete listing past day 3 with no receipt is nudged, and the receipt is recorded;
 *   - a complete listing is skipped (no email, no receipt);
 *   - a vendor that already has a receipt is skipped (no second email, ever);
 *   - a suppressed address is skipped without burning the one-shot receipt;
 *   - the day-3 cutoff is the value handed to the candidate query;
 *   - one vendor failing does not stop the rest of the batch.
 */
@ExtendWith(MockitoExtension.class)
class VendorListingNudgeServiceTest {

    @BeforeAll
    static void allowLockAssertOutsideRealSchedulerLock() {
        // sendNudges() calls LockAssert.assertLocked(); these tests build the service with plain
        // `new` and no Spring AOP proxy, so there is never a real lock. ShedLock's documented
        // pattern for unit-testing @SchedulerLock-annotated code.
        LockAssert.TestHelper.makeAllAssertsPass(true);
    }

    @Mock private VendorRepository vendorRepository;
    @Mock private VendorPortfolioPhotoRepository photoRepository;
    @Mock private VendorListingNudgeRepository nudgeRepository;
    @Mock private EmailSuppressionPort suppressionPort;
    @Mock private AsyncEmailService asyncEmailService;

    private VendorListingNudgeService service() {
        VendorListingNudgeSender sender = new VendorListingNudgeSender(
                asyncEmailService, nudgeRepository, "https://app.altarwed.com");
        return new VendorListingNudgeService(vendorRepository, photoRepository, nudgeRepository,
                suppressionPort, sender);
    }

    @Test
    void nudge_sentAndRecorded_forVendorMissingLogoPastDayThree() {
        Vendor vendor = vendor(null, "We shoot faith-filled weddings.");
        when(vendorRepository.findListingNudgeCandidates(any(), anyInt())).thenReturn(List.of(vendor));
        when(nudgeRepository.existsByVendorId(vendor.id())).thenReturn(false);
        when(photoRepository.countByVendorId(vendor.id())).thenReturn(4);
        when(suppressionPort.isSuppressed(anyString())).thenReturn(false);

        service().sendNudges();

        // Only the logo gap is flagged: the bio is present and there are four photos, so the
        // email renders a one-item checklist rather than a generic nag.
        verify(asyncEmailService).sendVendorListingNurtureEmail(
                eq("vendor@example.com"), eq("Grace Photography"),
                eq("https://app.altarwed.com/dashboard"),
                eq(true), eq(false), eq(false));
        // The receipt is written in the same unit of work, so this vendor is never nudged again.
        verify(nudgeRepository).markSent(vendor.id());
    }

    @Test
    void nudge_flagsEveryGap_whenLogoBioAndPhotosAllMissing() {
        Vendor vendor = vendor(null, "   ");
        when(vendorRepository.findListingNudgeCandidates(any(), anyInt())).thenReturn(List.of(vendor));
        when(nudgeRepository.existsByVendorId(vendor.id())).thenReturn(false);
        when(photoRepository.countByVendorId(vendor.id())).thenReturn(0);
        when(suppressionPort.isSuppressed(anyString())).thenReturn(false);

        service().sendNudges();

        // A whitespace-only bio counts as missing, same as null.
        verify(asyncEmailService).sendVendorListingNurtureEmail(
                anyString(), anyString(), anyString(), eq(true), eq(true), eq(true));
    }

    @Test
    void nudge_notSent_forCompleteListing() {
        // Logo and bio present plus at least one portfolio photo: nothing left to nudge about.
        Vendor vendor = vendor("https://cdn.altarwed.com/logo.png", "We shoot faith-filled weddings.");
        when(vendorRepository.findListingNudgeCandidates(any(), anyInt())).thenReturn(List.of(vendor));
        when(nudgeRepository.existsByVendorId(vendor.id())).thenReturn(false);
        when(photoRepository.countByVendorId(vendor.id())).thenReturn(6);

        service().sendNudges();

        verify(asyncEmailService, never()).sendVendorListingNurtureEmail(
                anyString(), anyString(), anyString(), anyBoolean(), anyBoolean(), anyBoolean());
        // No receipt either: the vendor stays eligible if they later strip their listing back.
        verify(nudgeRepository, never()).markSent(any());
    }

    @Test
    void nudge_notSent_whenVendorAlreadyHasReceipt() {
        // A stale candidate read (or a re-run inside the same batch): the per-vendor guard skips
        // it before any email is built, so a vendor is nudged at most once ever.
        Vendor vendor = vendor(null, null);
        when(vendorRepository.findListingNudgeCandidates(any(), anyInt())).thenReturn(List.of(vendor));
        when(nudgeRepository.existsByVendorId(vendor.id())).thenReturn(true);

        service().sendNudges();

        verify(photoRepository, never()).countByVendorId(any());
        verify(asyncEmailService, never()).sendVendorListingNurtureEmail(
                anyString(), anyString(), anyString(), anyBoolean(), anyBoolean(), anyBoolean());
        verify(nudgeRepository, never()).markSent(any());
    }

    @Test
    void nudge_notSent_whenAddressIsGloballySuppressed() {
        Vendor vendor = vendor(null, null);
        when(vendorRepository.findListingNudgeCandidates(any(), anyInt())).thenReturn(List.of(vendor));
        when(nudgeRepository.existsByVendorId(vendor.id())).thenReturn(false);
        when(photoRepository.countByVendorId(vendor.id())).thenReturn(0);
        when(suppressionPort.isSuppressed(anyString())).thenReturn(true);

        service().sendNudges();

        verify(asyncEmailService, never()).sendVendorListingNurtureEmail(
                anyString(), anyString(), anyString(), anyBoolean(), anyBoolean(), anyBoolean());
        // No receipt: a bounce/complaint that is later cleared should not have burned the one shot.
        verify(nudgeRepository, never()).markSent(any());
    }

    @Test
    void candidateQuery_usesDayThreeCutoff() {
        when(vendorRepository.findListingNudgeCandidates(any(), anyInt())).thenReturn(List.of());

        LocalDateTime before = LocalDateTime.now().minusDays(VendorListingNudgeService.NUDGE_AFTER_DAYS);
        service().sendNudges();
        LocalDateTime after = LocalDateTime.now().minusDays(VendorListingNudgeService.NUDGE_AFTER_DAYS);

        // The cutoff must land in the day-3-ago window computed around the call, and the batch
        // cap must be the one that bounds a single run's email burst.
        verify(vendorRepository).findListingNudgeCandidates(
                org.mockito.ArgumentMatchers.argThat(
                        cutoff -> !cutoff.isBefore(before) && !cutoff.isAfter(after)),
                eq(VendorListingNudgeService.BATCH_LIMIT));
    }

    @Test
    void oneVendorFailing_doesNotStopTheBatch() {
        Vendor failing = vendor(null, null);
        Vendor healthy = vendor(null, null);
        when(vendorRepository.findListingNudgeCandidates(any(), anyInt()))
                .thenReturn(List.of(failing, healthy));
        when(nudgeRepository.existsByVendorId(any())).thenReturn(false);
        when(photoRepository.countByVendorId(any())).thenReturn(0);
        when(suppressionPort.isSuppressed(anyString())).thenReturn(false);
        // The receipt insert loses a unique-constraint race for the first vendor.
        doThrow(new IllegalStateException("duplicate receipt"))
                .when(nudgeRepository).markSent(failing.id());

        service().sendNudges();

        // The second vendor is still processed: the per-vendor transaction boundary means one
        // failure never rolls back or aborts the rest of the run.
        verify(nudgeRepository).markSent(healthy.id());
        verify(asyncEmailService).sendVendorListingNurtureEmail(
                anyString(), anyString(), anyString(), anyBoolean(), anyBoolean(), anyBoolean());
    }

    // --- fixtures ------------------------------------------------------------------------------

    // Minimal vendor: only the fields the nudge flow reads (id, businessName, email, logoUrl,
    // bio) matter; createdAt is well past the day-3 cutoff so the candidate query would have
    // returned it.
    private static Vendor vendor(String logoUrl, String bio) {
        return new Vendor(
                UUID.randomUUID(), "Grace Photography", VendorCategory.PHOTOGRAPHER,
                "Austin", "TX", "vendor@example.com", "hash",
                true, List.of(), true, true, "$$",
                bio, null, null, null, logoUrl, 0, null,
                LocalDateTime.now().minusDays(5), LocalDateTime.now().minusDays(5));
    }
}
