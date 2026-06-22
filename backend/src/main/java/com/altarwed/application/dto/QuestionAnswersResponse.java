package com.altarwed.application.dto;

import com.altarwed.domain.model.CustomQuestionType;

import java.util.List;
import java.util.UUID;

// One question with all the answers guests gave to it, for the dashboard analytics.
public record QuestionAnswersResponse(
        UUID questionId,
        String questionText,
        CustomQuestionType type,
        List<AnswerEntry> answers
) {
    public record AnswerEntry(UUID guestId, String guestName, String answerText) {}
}
