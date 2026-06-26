package com.altarwed.web.exception;

import com.altarwed.domain.exception.BlogPostNotFoundException;
import com.altarwed.domain.exception.PortfolioCapExceededException;
import com.altarwed.domain.exception.BudgetItemNotFoundException;
import com.altarwed.domain.exception.SeatingTableNotFoundException;
import com.altarwed.domain.exception.CustomQuestionNotFoundException;
import com.altarwed.domain.exception.CoupleNotFoundException;
import com.altarwed.domain.exception.GoogleAuthRevokedException;
import com.altarwed.domain.exception.GuestNotFoundException;
import com.altarwed.domain.exception.WeddingPageBlockNotFoundException;
import com.altarwed.domain.exception.WeddingPartyMemberNotFoundException;
import com.altarwed.domain.exception.WeddingPhotoNotFoundException;
import com.altarwed.domain.exception.InvalidPasswordResetTokenException;
import com.altarwed.domain.exception.InvalidRefreshTokenException;
import com.altarwed.domain.exception.InvalidRsvpTokenException;
import com.altarwed.domain.exception.DenominationNotFoundException;
import com.altarwed.domain.exception.EmailAlreadyExistsException;
import com.altarwed.domain.exception.GuestUnsubscribedException;
import com.altarwed.domain.exception.SlugAlreadyTakenException;
import com.altarwed.domain.exception.StorageNotConfiguredException;
import com.altarwed.domain.exception.WeddingWebsiteAlreadyExistsException;
import com.altarwed.domain.exception.VendorNotFoundException;
import com.altarwed.domain.exception.WeddingWebsiteNotFoundException;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.NestedRuntimeException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.http.converter.HttpMessageNotWritableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.io.IOException;
import java.net.URI;
import java.util.Map;
import java.util.stream.Collectors;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(CoupleNotFoundException.class)
    public ProblemDetail handleCoupleNotFound(CoupleNotFoundException ex) {
        return notFound("couple-not-found", ex.getMessage());
    }

    @ExceptionHandler(VendorNotFoundException.class)
    public ProblemDetail handleVendorNotFound(VendorNotFoundException ex) {
        return notFound("vendor-not-found", ex.getMessage());
    }

    @ExceptionHandler(DenominationNotFoundException.class)
    public ProblemDetail handleDenominationNotFound(DenominationNotFoundException ex) {
        return notFound("denomination-not-found", ex.getMessage());
    }

    @ExceptionHandler(WeddingWebsiteNotFoundException.class)
    public ProblemDetail handleWeddingWebsiteNotFound(WeddingWebsiteNotFoundException ex) {
        return notFound("wedding-website-not-found", ex.getMessage());
    }

    @ExceptionHandler(GuestNotFoundException.class)
    public ProblemDetail handleGuestNotFound(GuestNotFoundException ex) {
        return notFound("guest-not-found", ex.getMessage());
    }

    @ExceptionHandler(WeddingPartyMemberNotFoundException.class)
    public ProblemDetail handleWeddingPartyMemberNotFound(WeddingPartyMemberNotFoundException ex) {
        return notFound("wedding-party-member-not-found", ex.getMessage());
    }

    @ExceptionHandler(WeddingPhotoNotFoundException.class)
    public ProblemDetail handleWeddingPhotoNotFound(WeddingPhotoNotFoundException ex) {
        return notFound("wedding-photo-not-found", ex.getMessage());
    }

    @ExceptionHandler(WeddingPageBlockNotFoundException.class)
    public ProblemDetail handleWeddingPageBlockNotFound(WeddingPageBlockNotFoundException ex) {
        return notFound("wedding-page-block-not-found", ex.getMessage());
    }

    @ExceptionHandler(BudgetItemNotFoundException.class)
    public ProblemDetail handleBudgetItemNotFound(BudgetItemNotFoundException ex) {
        return notFound("budget-item-not-found", ex.getMessage());
    }

    @ExceptionHandler(InvalidRsvpTokenException.class)
    public ProblemDetail handleInvalidRsvpToken(InvalidRsvpTokenException ex) {
        var pd = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
        pd.setType(URI.create("https://altarwed.com/problems/invalid-rsvp-token"));
        pd.setTitle("Invalid RSVP Token");
        pd.setDetail(ex.getMessage());
        return pd;
    }

    @ExceptionHandler(InvalidPasswordResetTokenException.class)
    public ProblemDetail handleInvalidPasswordResetToken(InvalidPasswordResetTokenException ex) {
        var pd = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
        pd.setType(URI.create("https://altarwed.com/problems/invalid-password-reset-token"));
        pd.setTitle("Invalid Password Reset Token");
        pd.setDetail(ex.getMessage());
        return pd;
    }

    @ExceptionHandler(GoogleAuthRevokedException.class)
    public ProblemDetail handleGoogleAuthRevoked(GoogleAuthRevokedException ex) {
        // 409 Conflict: the connection is in a state the user must resolve by
        // reconnecting. Message is safe to show; it carries no PII (coupleId only).
        var pd = ProblemDetail.forStatus(HttpStatus.CONFLICT);
        pd.setType(URI.create("https://altarwed.com/problems/google-auth-revoked"));
        pd.setTitle("Google Connection Expired");
        pd.setDetail("Your Google connection has expired. Reconnect your Google account to continue.");
        return pd;
    }

    @ExceptionHandler(SlugAlreadyTakenException.class)
    public ProblemDetail handleSlugAlreadyTaken(SlugAlreadyTakenException ex) {
        var pd = ProblemDetail.forStatus(HttpStatus.CONFLICT);
        pd.setType(URI.create("https://altarwed.com/problems/slug-already-taken"));
        pd.setTitle("Slug Already Taken");
        pd.setDetail(ex.getMessage());
        return pd;
    }

    @ExceptionHandler(WeddingWebsiteAlreadyExistsException.class)
    public ProblemDetail handleWeddingWebsiteAlreadyExists(WeddingWebsiteAlreadyExistsException ex) {
        var pd = ProblemDetail.forStatus(HttpStatus.CONFLICT);
        pd.setType(URI.create("https://altarwed.com/problems/website-already-exists"));
        pd.setTitle("Website Already Exists");
        pd.setDetail(ex.getMessage());
        return pd;
    }

    @ExceptionHandler(EmailAlreadyExistsException.class)
    public ProblemDetail handleEmailAlreadyExists(EmailAlreadyExistsException ex) {
        var pd = ProblemDetail.forStatus(HttpStatus.CONFLICT);
        pd.setType(URI.create("https://altarwed.com/problems/email-already-exists"));
        pd.setTitle("Email Already Exists");
        pd.setDetail(ex.getMessage());
        return pd;
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ProblemDetail handleBadCredentials(BadCredentialsException ex) {
        var pd = ProblemDetail.forStatus(HttpStatus.UNAUTHORIZED);
        pd.setType(URI.create("https://altarwed.com/problems/invalid-credentials"));
        pd.setTitle("Invalid Credentials");
        pd.setDetail("Email or password is incorrect");
        return pd;
    }

    @ExceptionHandler(DisabledException.class)
    public ProblemDetail handleDisabled(DisabledException ex) {
        var pd = ProblemDetail.forStatus(HttpStatus.FORBIDDEN);
        pd.setType(URI.create("https://altarwed.com/problems/account-disabled"));
        pd.setTitle("Account Disabled");
        pd.setDetail("This account has been deactivated");
        return pd;
    }

    @ExceptionHandler(InvalidRefreshTokenException.class)
    public ProblemDetail handleInvalidRefreshToken(InvalidRefreshTokenException ex) {
        var pd = ProblemDetail.forStatus(HttpStatus.UNAUTHORIZED);
        pd.setType(URI.create("https://altarwed.com/problems/invalid-refresh-token"));
        pd.setTitle("Invalid Refresh Token");
        pd.setDetail(ex.getMessage());
        return pd;
    }

    @ExceptionHandler(JwtException.class)
    public ProblemDetail handleJwtException(JwtException ex) {
        var pd = ProblemDetail.forStatus(HttpStatus.UNAUTHORIZED);
        pd.setType(URI.create("https://altarwed.com/problems/invalid-token"));
        pd.setTitle("Invalid Token");
        pd.setDetail(ex.getMessage());
        return pd;
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ProblemDetail handleValidationErrors(MethodArgumentNotValidException ex) {
        Map<String, String> fieldErrors = ex.getBindingResult().getFieldErrors().stream()
                .collect(Collectors.toMap(
                        FieldError::getField,
                        fe -> fe.getDefaultMessage() != null ? fe.getDefaultMessage() : "Invalid value",
                        (first, second) -> first
                ));
        var pd = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
        pd.setType(URI.create("https://altarwed.com/problems/validation-error"));
        pd.setTitle("Validation Error");
        pd.setDetail("One or more fields are invalid");
        pd.setProperty("errors", fieldErrors);
        return pd;
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ProblemDetail handleIllegalArgument(IllegalArgumentException ex) {
        var pd = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
        pd.setType(URI.create("https://altarwed.com/problems/bad-request"));
        pd.setTitle("Bad Request");
        pd.setDetail(ex.getMessage());
        return pd;
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ProblemDetail handleUnreadableMessage(HttpMessageNotReadableException ex) {
        var pd = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
        pd.setType(URI.create("https://altarwed.com/problems/malformed-request"));
        pd.setTitle("Malformed Request");
        pd.setDetail("Request body is missing or contains invalid JSON");
        return pd;
    }

    // A query/path param that won't bind to its declared type (e.g. a non-UUID where a
    // UUID is expected) is a client error, not a server fault. Without this it falls to
    // the catch-all 500, which both misleads the client and pages on-call. We name the
    // offending parameter but never echo the bad value (it could carry injected content).
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ProblemDetail handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        var pd = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
        pd.setType(URI.create("https://altarwed.com/problems/invalid-parameter"));
        pd.setTitle("Invalid Parameter");
        pd.setDetail("The '" + ex.getName() + "' parameter has an invalid value.");
        return pd;
    }

    // A missing required query/path param is likewise a 400, not a 500.
    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ProblemDetail handleMissingParameter(MissingServletRequestParameterException ex) {
        var pd = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
        pd.setType(URI.create("https://altarwed.com/problems/missing-parameter"));
        pd.setTitle("Missing Parameter");
        pd.setDetail("The '" + ex.getParameterName() + "' parameter is required.");
        return pd;
    }

    // Catches DB unique constraint violations that slip past service-layer checks
    // (e.g. two simultaneous registrations with the same email, race condition)
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ProblemDetail handleDataIntegrityViolation(DataIntegrityViolationException ex) {
        // ERROR because this signals a service-layer check missed a constraint, OR a
        // genuine race condition. Either way it deserves attention; not a routine 4xx.
        log.error("data integrity violation", ex);
        var pd = ProblemDetail.forStatus(HttpStatus.CONFLICT);
        pd.setType(URI.create("https://altarwed.com/problems/data-conflict"));
        pd.setTitle("Data Conflict");
        pd.setDetail("A record with this information already exists");
        return pd;
    }

    @ExceptionHandler(SeatingTableNotFoundException.class)
    public ProblemDetail handleSeatingTableNotFound(SeatingTableNotFoundException ex) {
        return notFound("seating-table-not-found", ex.getMessage());
    }

    @ExceptionHandler(CustomQuestionNotFoundException.class)
    public ProblemDetail handleCustomQuestionNotFound(CustomQuestionNotFoundException ex) {
        return notFound("custom-question-not-found", ex.getMessage());
    }

    @ExceptionHandler(BlogPostNotFoundException.class)
    public ProblemDetail handleBlogPostNotFound(BlogPostNotFoundException ex) {
        return notFound("blog-post-not-found", ex.getMessage());
    }

    @ExceptionHandler(PortfolioCapExceededException.class)
    public ProblemDetail handlePortfolioCapExceeded(PortfolioCapExceededException ex) {
        var pd = ProblemDetail.forStatus(HttpStatus.UNPROCESSABLE_ENTITY);
        pd.setType(URI.create("https://altarwed.com/problems/portfolio-cap-exceeded"));
        pd.setTitle("Portfolio Cap Exceeded");
        pd.setDetail(ex.getMessage());
        return pd;
    }

    // 422: a well-formed, authorized invite we decline to send because the guest's
    // address is unsubscribed. Detail tells the couple how to invite them another way;
    // it carries no PII (no guest email/name).
    @ExceptionHandler(GuestUnsubscribedException.class)
    public ProblemDetail handleGuestUnsubscribed(GuestUnsubscribedException ex) {
        var pd = ProblemDetail.forStatus(HttpStatus.UNPROCESSABLE_ENTITY);
        pd.setType(URI.create("https://altarwed.com/problems/guest-unsubscribed"));
        pd.setTitle("Guest Unsubscribed");
        pd.setDetail(ex.getMessage());
        return pd;
    }

    // Unmapped routes hit Spring's default handler and throw this. Without an explicit
    // handler it falls through to the catch-all below and reports as a 500, which is
    // misleading (the request was syntactically fine; the path just does not exist).
    // Common cause: client/server version skew during a rolling deploy.
    @ExceptionHandler(NoResourceFoundException.class)
    public ProblemDetail handleNoResourceFound(NoResourceFoundException ex) {
        var pd = ProblemDetail.forStatus(HttpStatus.NOT_FOUND);
        pd.setType(URI.create("https://altarwed.com/problems/route-not-found"));
        pd.setTitle("Not Found");
        pd.setDetail("No endpoint exists for this path.");
        return pd;
    }

    // Authorization failure (IDOR guard, ownership mismatch). The guard already
    // WARN-logs the security details; here we just translate to a clean 403 with
    // no resource detail, so a probing couple learns nothing about what exists.
    @ExceptionHandler(AccessDeniedException.class)
    public ProblemDetail handleAccessDenied(AccessDeniedException ex) {
        var pd = ProblemDetail.forStatus(HttpStatus.FORBIDDEN);
        pd.setType(URI.create("https://altarwed.com/problems/access-denied"));
        pd.setTitle("Access Denied");
        pd.setDetail("You do not have access to this resource.");
        return pd;
    }

    // 503: a media operation was attempted while blob storage is unconfigured
    // (AZURE_STORAGE_CONNECTION_STRING blank). The app boots healthy by design and only this one
    // feature degrades; the adapter already WARN-logs with context, so here we just translate.
    // Mapped to 503 (not the catch-all 500) so this known config gap never pages on-call as ERROR.
    @ExceptionHandler(StorageNotConfiguredException.class)
    public ProblemDetail handleStorageNotConfigured(StorageNotConfiguredException ex) {
        var pd = ProblemDetail.forStatus(HttpStatus.SERVICE_UNAVAILABLE);
        pd.setType(URI.create("https://altarwed.com/problems/storage-unavailable"));
        pd.setTitle("Media Storage Unavailable");
        pd.setDetail("Media uploads are temporarily unavailable. Please try again later.");
        return pd;
    }

    // Thrown while serializing the response body. Two very different causes hide here:
    //  1. The client hung up mid-response (browser navigated away, an SPA token-refresh retry
    //     cancelled the in-flight request, or a proxy closed the connection) -> the root cause is
    //     a "broken pipe"/"connection reset" IOException. This is NOT a server fault: the socket
    //     is already dead, so we cannot and need not write a body. Log DEBUG so it does not trip
    //     the App Insights exception-rate alert (rule 1: ERROR pages on-call, don't cry wolf).
    //  2. A genuine serialization failure (no serializer, a cycle) -> that IS a server bug, so it
    //     keeps the ERROR log + 500, same as the catch-all.
    // Without this, both fall to handleUnexpected and a routine client disconnect pages on-call.
    @ExceptionHandler(HttpMessageNotWritableException.class)
    public ProblemDetail handleNotWritable(HttpMessageNotWritableException ex, HttpServletResponse response) {
        if (isBenignClientDisconnect(ex, response)) {
            log.debug("client disconnected during response body write; skipping body");
            return null; // response is committed/broken; returning a body would just fail again
        }
        log.error("response serialization failed, exceptionType={}", mostSpecificType(ex), ex);
        return internalError();
    }

    // Safety net: catches anything not handled above so stack traces never leak.
    // This is the ONE place we guarantee a log for every 500. Without it, an
    // unhandled exception silently maps to JSON and disappears.
    @ExceptionHandler(Exception.class)
    public ProblemDetail handleUnexpected(Exception ex, HttpServletResponse response) {
        // A client disconnect can also surface here (e.g. a write outside the body converter),
        // so apply the same guard: don't ERROR-log or page on-call for a browser that hung up.
        if (isBenignClientDisconnect(ex, response)) {
            log.debug("client disconnected during response body write; skipping body");
            return null;
        }
        log.error("unhandled exception, exceptionType={}", ex.getClass().getSimpleName(), ex);
        return internalError();
    }

    // A disconnect is only benign to swallow if the response is ALREADY committed, i.e. we failed
    // partway through writing the body to a socket the client closed. If the response is NOT yet
    // committed, the same "connection reset"/"broken pipe" almost always came from an UPSTREAM call
    // (bible-api, Lob, Resend, Stripe, Blob) inside business logic that threw before we wrote
    // anything; that is a real 500 we must log and surface, never silently turn into an empty 200.
    private static boolean isBenignClientDisconnect(Throwable ex, HttpServletResponse response) {
        return response.isCommitted() && isClientDisconnect(ex);
    }

    // True when any cause in the chain is a connection drop. Tomcat raises ClientAbortException
    // (checked by class name to avoid importing a container-internal type); other paths surface a
    // plain IOException whose message is "Broken pipe" / "Connection reset". The depth cap guards
    // against a self-referential or cyclic cause chain (cf. Spring's NestedExceptionUtils).
    static boolean isClientDisconnect(Throwable ex) {
        Throwable t = ex;
        for (int depth = 0; t != null && depth < 16; t = t.getCause(), depth++) {
            if (t.getClass().getName().equals("org.apache.catalina.connector.ClientAbortException")) {
                return true;
            }
            if (t instanceof IOException && t.getMessage() != null) {
                String m = t.getMessage().toLowerCase();
                if (m.contains("broken pipe") || m.contains("connection reset")) {
                    return true;
                }
            }
        }
        return false;
    }

    private static String mostSpecificType(NestedRuntimeException ex) {
        Throwable cause = ex.getMostSpecificCause();
        return cause.getClass().getSimpleName();
    }

    private static ProblemDetail internalError() {
        var pd = ProblemDetail.forStatus(HttpStatus.INTERNAL_SERVER_ERROR);
        pd.setType(URI.create("https://altarwed.com/problems/internal-error"));
        pd.setTitle("Internal Server Error");
        pd.setDetail("An unexpected error occurred. Please try again later.");
        return pd;
    }

    private ProblemDetail notFound(String errorCode, String detail) {
        var pd = ProblemDetail.forStatus(HttpStatus.NOT_FOUND);
        pd.setType(URI.create("https://altarwed.com/problems/" + errorCode));
        pd.setTitle("Not Found");
        pd.setDetail(detail);
        return pd;
    }
}
