package com.altarwed.web.exception;

import com.altarwed.domain.exception.BudgetItemNotFoundException;
import com.altarwed.domain.exception.CoupleNotFoundException;
import com.altarwed.domain.exception.GuestNotFoundException;
import com.altarwed.domain.exception.WeddingPartyMemberNotFoundException;
import com.altarwed.domain.exception.WeddingPhotoNotFoundException;
import com.altarwed.domain.exception.WeddingPrayerNotFoundException;
import com.altarwed.domain.exception.InvalidPasswordResetTokenException;
import com.altarwed.domain.exception.InvalidRefreshTokenException;
import com.altarwed.domain.exception.InvalidRsvpTokenException;
import com.altarwed.domain.exception.DenominationNotFoundException;
import com.altarwed.domain.exception.EmailAlreadyExistsException;
import com.altarwed.domain.exception.SlugAlreadyTakenException;
import com.altarwed.domain.exception.WeddingWebsiteAlreadyExistsException;
import com.altarwed.domain.exception.VendorNotFoundException;
import com.altarwed.domain.exception.WeddingWebsiteNotFoundException;
import io.jsonwebtoken.JwtException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.net.URI;
import java.util.Map;
import java.util.stream.Collectors;

@RestControllerAdvice
public class GlobalExceptionHandler {

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

    @ExceptionHandler(WeddingPrayerNotFoundException.class)
    public ProblemDetail handleWeddingPrayerNotFound(WeddingPrayerNotFoundException ex) {
        return notFound("wedding-prayer-not-found", ex.getMessage());
    }

    @ExceptionHandler(WeddingPhotoNotFoundException.class)
    public ProblemDetail handleWeddingPhotoNotFound(WeddingPhotoNotFoundException ex) {
        return notFound("wedding-photo-not-found", ex.getMessage());
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

    // Catches DB unique constraint violations that slip past service-layer checks
    // (e.g. two simultaneous registrations with the same email — race condition)
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ProblemDetail handleDataIntegrityViolation(DataIntegrityViolationException ex) {
        var pd = ProblemDetail.forStatus(HttpStatus.CONFLICT);
        pd.setType(URI.create("https://altarwed.com/problems/data-conflict"));
        pd.setTitle("Data Conflict");
        pd.setDetail("A record with this information already exists");
        return pd;
    }

    // Safety net — catches anything not handled above so stack traces never leak
    @ExceptionHandler(Exception.class)
    public ProblemDetail handleUnexpected(Exception ex) {
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
