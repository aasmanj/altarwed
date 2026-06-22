package com.altarwed.domain.port;

import com.altarwed.domain.model.CustomRsvpQuestion;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CustomRsvpQuestionRepository {
    CustomRsvpQuestion save(CustomRsvpQuestion question);
    Optional<CustomRsvpQuestion> findById(UUID id);
    /** All questions for a couple (active and inactive), ordered by sortOrder. */
    List<CustomRsvpQuestion> findAllByCoupleId(UUID coupleId);
    /** Active questions only, ordered by sortOrder, for rendering the RSVP form. */
    List<CustomRsvpQuestion> findActiveByCoupleId(UUID coupleId);
    void deleteById(UUID id);
    boolean existsByIdAndCoupleId(UUID id, UUID coupleId);
}
