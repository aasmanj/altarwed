package com.altarwed.domain.exception;

public class CaptchaVerificationFailedException extends RuntimeException {
    public CaptchaVerificationFailedException() {
        super("Captcha verification failed, please try again");
    }
}
