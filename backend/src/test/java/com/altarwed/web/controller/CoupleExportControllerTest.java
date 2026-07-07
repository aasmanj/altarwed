package com.altarwed.web.controller;

import com.altarwed.application.service.GuestService;
import com.altarwed.application.service.WeddingWebsiteService;
import com.altarwed.web.security.CoupleAccessGuard;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link CoupleExportController} (issue #253).
 *
 * Controllers are plain classes, so this is a Mockito-only unit test (no Spring context, no
 * Docker). Two behaviours per endpoint:
 *   200 path: the ownership guard passes, the service is called, and the response carries the
 *             correct Content-Disposition (attachment) header so the browser downloads a file.
 *   403 path: a mismatched coupleId makes CoupleAccessGuard.assertOwns throw AccessDeniedException
 *             (mapped to 403 by GlobalExceptionHandler), and the export service is never invoked
 *             so no other couple's data is read.
 */
class CoupleExportControllerTest {

    private final GuestService guestService = mock(GuestService.class);
    private final WeddingWebsiteService weddingWebsiteService = mock(WeddingWebsiteService.class);
    private final CoupleAccessGuard accessGuard = mock(CoupleAccessGuard.class);

    private final CoupleExportController controller =
            new CoupleExportController(guestService, weddingWebsiteService, accessGuard);

    private final UUID coupleId = UUID.randomUUID();
    private final String email = "owner@example.com";

    @Test
    void exportGuests_returns200WithCsvAttachment() {
        String csv = "\uFEFFGuest Name(s),Party\r\nJordan,\r\n";
        when(guestService.exportGuestsCsv(coupleId)).thenReturn(csv);

        ResponseEntity<byte[]> response = controller.exportGuests(coupleId, email);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo(csv.getBytes(StandardCharsets.UTF_8));
        String disposition = response.getHeaders().getFirst(HttpHeaders.CONTENT_DISPOSITION);
        assertThat(disposition).isNotNull();
        assertThat(disposition).startsWith("attachment;");
        assertThat(disposition).contains("guest-list-");
        assertThat(disposition).contains(".csv");
        verify(accessGuard).assertOwns(coupleId, email);
    }

    @Test
    void exportGuests_returns403OnOwnershipMismatch() {
        doThrow(new AccessDeniedException("Access denied"))
                .when(accessGuard).assertOwns(eq(coupleId), eq(email));

        assertThatThrownBy(() -> controller.exportGuests(coupleId, email))
                .isInstanceOf(AccessDeniedException.class);

        verify(guestService, never()).exportGuestsCsv(coupleId);
    }

    @Test
    void exportWebsite_returns200WithJsonAttachment() {
        String json = "{\n  \"website\" : { }\n}";
        when(weddingWebsiteService.exportWebsiteJson(coupleId)).thenReturn(json);

        ResponseEntity<byte[]> response = controller.exportWebsite(coupleId, email);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo(json.getBytes(StandardCharsets.UTF_8));
        String disposition = response.getHeaders().getFirst(HttpHeaders.CONTENT_DISPOSITION);
        assertThat(disposition).isNotNull();
        assertThat(disposition).startsWith("attachment;");
        assertThat(disposition).contains("wedding-website-");
        assertThat(disposition).contains(".json");
        verify(accessGuard).assertOwns(coupleId, email);
    }

    @Test
    void exportWebsite_returns403OnOwnershipMismatch() {
        doThrow(new AccessDeniedException("Access denied"))
                .when(accessGuard).assertOwns(eq(coupleId), eq(email));

        assertThatThrownBy(() -> controller.exportWebsite(coupleId, email))
                .isInstanceOf(AccessDeniedException.class);

        verify(weddingWebsiteService, never()).exportWebsiteJson(coupleId);
    }
}
