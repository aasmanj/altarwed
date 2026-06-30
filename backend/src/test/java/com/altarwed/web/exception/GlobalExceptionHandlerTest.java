package com.altarwed.web.exception;

import com.altarwed.domain.exception.FileTooLargeException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.HttpMessageNotWritableException;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import java.io.IOException;
import java.net.SocketException;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pure unit tests for the client-disconnect handling. The bug: a browser hanging up mid-response
 * (broken pipe) was caught by the catch-all and logged at ERROR as "unhandled exception", which
 * trips the App Insights exception-rate alert for something that is not a server fault.
 *
 * The subtle hazard (caught in review): the disconnect must only be swallowed when the response is
 * already committed (failed mid-write). An identical "connection reset" before commit almost always
 * came from an upstream call inside business logic and is a real 500 we must NOT turn into an empty
 * 200, so the committed/uncommitted distinction is asserted explicitly here.
 */
class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    private static MockHttpServletResponse committed() {
        var r = new MockHttpServletResponse();
        r.setCommitted(true);
        return r;
    }

    private static MockHttpServletResponse notCommitted() {
        return new MockHttpServletResponse(); // committed=false by default
    }

    @Test
    void detects_broken_pipe_as_client_disconnect() {
        assertThat(GlobalExceptionHandler.isClientDisconnect(new IOException("Broken pipe"))).isTrue();
    }

    @Test
    void detects_connection_reset_as_client_disconnect() {
        assertThat(GlobalExceptionHandler.isClientDisconnect(new IOException("Connection reset by peer"))).isTrue();
    }

    @Test
    void detects_disconnect_nested_in_the_cause_chain() {
        // Mirrors the prod chain: HttpMessageNotWritableException -> ... -> IOException("Broken pipe").
        var wrapped = new HttpMessageNotWritableException(
                "Could not write JSON", new RuntimeException(new IOException("Broken pipe")));
        assertThat(GlobalExceptionHandler.isClientDisconnect(wrapped)).isTrue();
    }

    @Test
    void does_not_flag_an_unrelated_io_error_as_disconnect() {
        assertThat(GlobalExceptionHandler.isClientDisconnect(new IOException("No space left on device"))).isFalse();
        assertThat(GlobalExceptionHandler.isClientDisconnect(new IllegalStateException("boom"))).isFalse();
    }

    @Test
    void notWritable_returns_no_body_on_disconnect_after_commit() {
        var ex = new HttpMessageNotWritableException("Could not write JSON", new IOException("Broken pipe"));
        // null => Spring writes no body; the socket is already dead so a 500 body would just re-fail.
        assertThat(handler.handleNotWritable(ex, committed())).isNull();
    }

    @Test
    void notWritable_returns_500_on_a_genuine_serialization_failure() {
        var ex = new HttpMessageNotWritableException("No serializer found", new RuntimeException("no serializer"));
        ProblemDetail pd = handler.handleNotWritable(ex, notCommitted());
        assertThat(pd).isNotNull();
        assertThat(pd.getStatus()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR.value());
    }

    @Test
    void catchAll_swallows_disconnect_only_after_commit() {
        // Committed + disconnect => benign, no body.
        assertThat(handler.handleUnexpected(new RuntimeException(new IOException("Broken pipe")), committed())).isNull();
    }

    @Test
    void catchAll_returns_500_for_upstream_connection_reset_before_commit() {
        // The critical case: an upstream "Connection reset" (e.g. bible-api/Lob) propagating through
        // business logic before any response was written must stay a real 500, never a silent 200.
        var upstream = new RuntimeException("upstream call failed", new SocketException("Connection reset"));
        ProblemDetail pd = handler.handleUnexpected(upstream, notCommitted());
        assertThat(pd).isNotNull();
        assertThat(pd.getStatus()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR.value());
    }

    @Test
    void catchAll_returns_500_for_a_plain_unexpected_error() {
        ProblemDetail pd = handler.handleUnexpected(new RuntimeException("unexpected"), notCommitted());
        assertThat(pd).isNotNull();
        assertThat(pd.getStatus()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR.value());
    }

    // Issue #93: an upload over spring.servlet.multipart.max-file-size used to fall to the catch-all
    // 500 and page on-call. It must now be a clean 413 with a real, user-facing reason.
    @Test
    void maxUploadSizeExceeded_maps_to_413_with_a_clean_message() {
        ProblemDetail pd = handler.handleMaxUploadSizeExceeded(new MaxUploadSizeExceededException(20L * 1024 * 1024));
        assertThat(pd).isNotNull();
        assertThat(pd.getStatus()).isEqualTo(HttpStatus.PAYLOAD_TOO_LARGE.value());
        assertThat(pd.getDetail()).contains("20 MB");
    }

    // A service-layer oversize (FileTooLargeException) is the same user-facing meaning, so it must
    // also be 413 (not the old generic 400 the frontend could not distinguish from a bad file type).
    @Test
    void fileTooLarge_maps_to_413_and_surfaces_the_service_message() {
        ProblemDetail pd = handler.handleFileTooLarge(new FileTooLargeException("File must be under 20 MB"));
        assertThat(pd).isNotNull();
        assertThat(pd.getStatus()).isEqualTo(HttpStatus.PAYLOAD_TOO_LARGE.value());
        assertThat(pd.getDetail()).isEqualTo("File must be under 20 MB");
    }
}
