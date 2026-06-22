package com.altarwed.application.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

// One answer to a custom question, submitted with the RSVP. Included in
// SubmitRsvpRequest.customAnswers.
public record CustomAnswerSubmission(
        @NotNull UUID questionId,
        @Size(max = 2000) String answerText
) {}
