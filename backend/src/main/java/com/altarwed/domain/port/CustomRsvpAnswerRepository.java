package com.altarwed.domain.port;

import com.altarwed.domain.model.CustomRsvpAnswer;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface CustomRsvpAnswerRepository {
    List<CustomRsvpAnswer> saveAll(List<CustomRsvpAnswer> answers);
    List<CustomRsvpAnswer> findByGuestId(UUID guestId);
    /** All answers to the given questions, for analytics aggregation. */
    List<CustomRsvpAnswer> findByQuestionIdIn(Collection<UUID> questionIds);
    void deleteByGuestId(UUID guestId);
    void deleteByQuestionId(UUID questionId);
}
