package com.altarwed.application.dto;

import com.altarwed.domain.model.GuestRsvpStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

public record SubmitRsvpRequest(
        @NotBlank String token,
        @NotNull GuestRsvpStatus status,
        @Size(max = 200) String plusOneName,
        @Size(max = 500) String dietaryRestrictions,
        @Size(max = 200) String songRequest,
        // Private note from guest to the couple; surfaced only on the couple's dashboard.
        @Size(max = 1000) String noteForCouple,
        // When set, schedules a reminder invite in this many days. Frontend sends 1, 3, or 7.
        // The backend computes remindAt = now + remindInDays. Null means no reminder.
        @Min(1) @Max(30) Integer remindInDays,
        // When the guest belongs to a party, individual responses for each member.
        // If present, the primary guest status/remindInDays fields still apply to the
        // token holder; partyResponses applies to the other members listed.
        // @Valid is required for Bean Validation to cascade into the list elements;
        // without it the @NotNull/@Size constraints on PartyMemberResponse never fire and
        // an over-length dietary/song string reaches the DB and aborts the insert.
        @Valid List<PartyMemberResponse> partyResponses,
        // Answers to the couple's custom RSVP questions, one per answered question. Capped
        // so a malicious submit on this public, token-gated path cannot flood the answer
        // table or the logs.
        @Size(max = 50) @Valid List<CustomAnswerSubmission> customAnswers
) {}
