package com.altarwed.application.service;

import com.altarwed.domain.model.AcquisitionSource;
import com.altarwed.domain.model.Couple;
import com.altarwed.domain.model.WeddingPartyMember;
import com.altarwed.domain.model.WeddingPhoto;
import com.altarwed.domain.model.WeddingWebsite;
import com.altarwed.domain.port.BlobStoragePort;
import com.altarwed.domain.port.CeremonySectionRepository;
import com.altarwed.domain.port.CoupleRepository;
import com.altarwed.domain.port.GoogleOAuthTokenRepository;
import com.altarwed.domain.port.PasswordResetTokenRepository;
import com.altarwed.domain.port.PrintOrderRepository;
import com.altarwed.domain.port.RefreshTokenRepository;
import com.altarwed.domain.port.WeddingPartyMemberRepository;
import com.altarwed.domain.port.WeddingPhotoRepository;
import com.altarwed.domain.port.WeddingWebsiteRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Issue #384: deleting a couple must also purge their uploaded photos from Blob storage (which the
 * DB cascade cannot reach). Mockito, no Spring context. With no active transaction the service runs
 * the blob cleanup inline (its afterCommit fallback), so these tests can assert on blobStorage.delete
 * directly.
 */
@ExtendWith(MockitoExtension.class)
class CoupleServiceTest {

    @Mock private CoupleRepository coupleRepository;
    @Mock private PrintOrderRepository printOrderRepository;
    @Mock private CeremonySectionRepository ceremonySectionRepository;
    @Mock private RefreshTokenRepository refreshTokenRepository;
    @Mock private PasswordResetTokenRepository passwordResetTokenRepository;
    @Mock private GoogleOAuthTokenRepository googleOAuthTokenRepository;
    @Mock private WeddingWebsiteRepository weddingWebsiteRepository;
    @Mock private WeddingPhotoRepository weddingPhotoRepository;
    @Mock private WeddingPartyMemberRepository weddingPartyMemberRepository;
    @Mock private BlobStoragePort blobStorage;
    @Mock private AsyncEmailService asyncEmailService;

    private CoupleService service() {
        return new CoupleService(
                coupleRepository, printOrderRepository, ceremonySectionRepository,
                refreshTokenRepository, passwordResetTokenRepository, googleOAuthTokenRepository,
                weddingWebsiteRepository, weddingPhotoRepository, weddingPartyMemberRepository,
                blobStorage, asyncEmailService);
    }

    private final UUID coupleId = UUID.randomUUID();
    private final UUID siteId = UUID.randomUUID();

    private Couple couple() {
        return new Couple(coupleId, "Jordan", "Eden", "couple@example.test", "hash",
                null, null, AcquisitionSource.empty(), false, true, LocalDateTime.now(), LocalDateTime.now());
    }

    private WeddingWebsite website(String hero, String venue, String std) {
        return new WeddingWebsite(
                siteId, coupleId, "our-slug", true,
                "P1", "P2", LocalDate.of(2026, 6, 20), null,
                hero, null, null, null, null,
                null, null, null, null,
                null, null, null, null, null, null,
                venue, null,
                null, null, null,
                null, null, null, null, null, null,
                null, null, null, null,
                null, null, null, null,
                std,
                false, null, null, null);
    }

    private WeddingPhoto photo(String url) {
        return new WeddingPhoto(UUID.randomUUID(), siteId, url, null, 0, LocalDateTime.now(), null, null, null);
    }

    private WeddingPartyMember member(String photoUrl) {
        return new WeddingPartyMember(UUID.randomUUID(), siteId, "Name", "Role", null, null,
                photoUrl, 0, LocalDateTime.now(), LocalDateTime.now(), null, null, null);
    }

    @Test
    void deleteAccount_purgesEveryCoupleBlob_thenDeletesTheAccount() {
        when(coupleRepository.findById(coupleId)).thenReturn(Optional.of(couple()));
        when(weddingWebsiteRepository.findByCoupleId(coupleId))
                .thenReturn(Optional.of(website("https://blob/hero.jpg", "https://blob/venue.jpg", "https://blob/std.jpg")));
        when(weddingPhotoRepository.findAllByWeddingWebsiteId(siteId))
                .thenReturn(List.of(photo("https://blob/album1.jpg"), photo("https://blob/album2.jpg")));
        when(weddingPartyMemberRepository.findAllByWeddingWebsiteId(siteId))
                .thenReturn(List.of(member("https://blob/party1.jpg")));

        service().deleteAccount(coupleId);

        // Every uploaded image is purged from blob storage.
        verify(blobStorage).delete("https://blob/hero.jpg");
        verify(blobStorage).delete("https://blob/venue.jpg");
        verify(blobStorage).delete("https://blob/std.jpg");
        verify(blobStorage).delete("https://blob/album1.jpg");
        verify(blobStorage).delete("https://blob/album2.jpg");
        verify(blobStorage).delete("https://blob/party1.jpg");
        // And the account itself is deleted, and the confirmation email queued.
        verify(coupleRepository).deleteById(coupleId);
        verify(asyncEmailService).sendAccountDeletedEmail("couple@example.test", "Jordan", "Eden");
    }

    @Test
    void deleteAccount_skipsNullAndBlankPhotoUrls() {
        when(coupleRepository.findById(coupleId)).thenReturn(Optional.of(couple()));
        when(weddingWebsiteRepository.findByCoupleId(coupleId))
                .thenReturn(Optional.of(website("https://blob/hero.jpg", null, "  ")));
        when(weddingPhotoRepository.findAllByWeddingWebsiteId(siteId))
                .thenReturn(List.of(photo(null), photo("https://blob/album1.jpg")));
        when(weddingPartyMemberRepository.findAllByWeddingWebsiteId(siteId))
                .thenReturn(List.of(member(null)));

        service().deleteAccount(coupleId);

        verify(blobStorage).delete("https://blob/hero.jpg");
        verify(blobStorage).delete("https://blob/album1.jpg");
        // Null/blank urls never reach blob storage.
        verify(blobStorage, never()).delete(null);
        verify(blobStorage, never()).delete("  ");
        verify(coupleRepository).deleteById(coupleId);
    }

    @Test
    void deleteAccount_isBestEffort_oneFailingBlobDoesNotStopTheOthersOrThrow() {
        when(coupleRepository.findById(coupleId)).thenReturn(Optional.of(couple()));
        when(weddingWebsiteRepository.findByCoupleId(coupleId))
                .thenReturn(Optional.of(website("https://blob/hero.jpg", "https://blob/venue.jpg", null)));
        when(weddingPhotoRepository.findAllByWeddingWebsiteId(siteId)).thenReturn(List.of());
        when(weddingPartyMemberRepository.findAllByWeddingWebsiteId(siteId)).thenReturn(List.of());
        doThrow(new RuntimeException("azure 500")).when(blobStorage).delete("https://blob/hero.jpg");

        service().deleteAccount(coupleId); // must not throw

        // The failing blob was attempted, and the next one still ran.
        verify(blobStorage).delete("https://blob/hero.jpg");
        verify(blobStorage).delete("https://blob/venue.jpg");
        verify(coupleRepository).deleteById(coupleId);
    }

    @Test
    void deleteAccount_withNoWebsite_deletesAccountAndTouchesNoBlobs() {
        when(coupleRepository.findById(coupleId)).thenReturn(Optional.of(couple()));
        when(weddingWebsiteRepository.findByCoupleId(coupleId)).thenReturn(Optional.empty());

        service().deleteAccount(coupleId);

        verify(blobStorage, never()).delete(anyString());
        verify(weddingPhotoRepository, never()).findAllByWeddingWebsiteId(any());
        verify(coupleRepository).deleteById(coupleId);
        verify(asyncEmailService).sendAccountDeletedEmail(anyString(), anyString(), anyString());
    }
}
