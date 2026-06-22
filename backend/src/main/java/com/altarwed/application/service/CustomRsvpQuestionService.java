package com.altarwed.application.service;

import com.altarwed.application.dto.CreateCustomQuestionRequest;
import com.altarwed.application.dto.CustomAnswerSubmission;
import com.altarwed.application.dto.CustomQuestionPublic;
import com.altarwed.application.dto.QuestionAnswersResponse;
import com.altarwed.application.dto.UpdateCustomQuestionRequest;
import com.altarwed.domain.exception.CustomQuestionNotFoundException;
import com.altarwed.domain.model.CustomQuestionType;
import com.altarwed.domain.model.CustomRsvpAnswer;
import com.altarwed.domain.model.CustomRsvpQuestion;
import com.altarwed.domain.model.Guest;
import com.altarwed.domain.port.CustomRsvpAnswerRepository;
import com.altarwed.domain.port.CustomRsvpQuestionRepository;
import com.altarwed.domain.port.GuestRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Couple-defined custom RSVP questions and the answers guests give to them. Questions are
 * answered once per RSVP submission (household-level), stored against the responding guest.
 */
@Service
public class CustomRsvpQuestionService {

    private static final Logger log = LoggerFactory.getLogger(CustomRsvpQuestionService.class);

    private final CustomRsvpQuestionRepository questionRepository;
    private final CustomRsvpAnswerRepository answerRepository;
    private final GuestRepository guestRepository;

    public CustomRsvpQuestionService(
            CustomRsvpQuestionRepository questionRepository,
            CustomRsvpAnswerRepository answerRepository,
            GuestRepository guestRepository
    ) {
        this.questionRepository = questionRepository;
        this.answerRepository = answerRepository;
        this.guestRepository = guestRepository;
    }

    // -----------------------------------------------------------------------
    // Couple editor CRUD
    // -----------------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<CustomRsvpQuestion> list(UUID coupleId) {
        return questionRepository.findAllByCoupleId(coupleId);
    }

    @Transactional
    public CustomRsvpQuestion create(UUID coupleId, CreateCustomQuestionRequest req) {
        int nextSort = questionRepository.findAllByCoupleId(coupleId).size();
        CustomRsvpQuestion q = new CustomRsvpQuestion(
                null, coupleId, req.questionText().trim(), req.type(),
                cleanOptions(req.type(), req.options()),
                req.required() != null && req.required(),
                nextSort, true, null, null);
        CustomRsvpQuestion saved = questionRepository.save(q);
        log.info("custom rsvp question created, coupleId={}, questionId={}, type={}", coupleId, saved.id(), saved.type());
        return saved;
    }

    @Transactional
    public CustomRsvpQuestion update(UUID coupleId, UUID questionId, UpdateCustomQuestionRequest req) {
        CustomRsvpQuestion existing = get(coupleId, questionId);
        CustomQuestionType type = req.type() != null ? req.type() : existing.type();
        // A non-null options list replaces the stored choices; otherwise keep them. Either
        // way, a non-CHOICE question never keeps options.
        List<String> options = req.options() != null
                ? cleanOptions(type, req.options())
                : cleanOptions(type, existing.options());
        CustomRsvpQuestion updated = new CustomRsvpQuestion(
                existing.id(), existing.coupleId(),
                req.questionText() != null ? req.questionText().trim() : existing.questionText(),
                type, options,
                req.required() != null ? req.required() : existing.required(),
                req.sortOrder() != null ? req.sortOrder() : existing.sortOrder(),
                req.active() != null ? req.active() : existing.active(),
                existing.createdAt(), LocalDateTime.now());
        CustomRsvpQuestion saved = questionRepository.save(updated);
        log.info("custom rsvp question updated, coupleId={}, questionId={}", coupleId, questionId);
        return saved;
    }

    @Transactional
    public void delete(UUID coupleId, UUID questionId) {
        if (!questionRepository.existsByIdAndCoupleId(questionId, coupleId)) {
            throw new CustomQuestionNotFoundException(questionId.toString());
        }
        // The answers.question_id FK is NO ACTION (see V71), so clear answers before
        // removing the question to avoid a constraint violation.
        answerRepository.deleteByQuestionId(questionId);
        questionRepository.deleteById(questionId);
        log.info("custom rsvp question deleted, coupleId={}, questionId={}", coupleId, questionId);
    }

    // -----------------------------------------------------------------------
    // RSVP flow
    // -----------------------------------------------------------------------

    /** Active questions for a couple, trimmed for the public RSVP form. */
    @Transactional(readOnly = true)
    public List<CustomQuestionPublic> activeForRsvp(UUID coupleId) {
        return questionRepository.findActiveByCoupleId(coupleId).stream()
                .map(q -> new CustomQuestionPublic(q.id(), q.questionText(), q.type(), q.options(), q.required()))
                .toList();
    }

    /**
     * Replaces the responding guest's custom answers with the submitted set. Always clears
     * first so removing an answer on a re-RSVP actually deletes it. Only answers to the
     * couple's currently-active questions are accepted; a stale or cross-couple questionId is
     * dropped and logged (tamper signal). Blank answers are skipped so an untouched optional
     * field never creates an empty row.
     */
    @Transactional
    public void replaceAnswers(UUID coupleId, UUID guestId, List<CustomAnswerSubmission> submissions) {
        answerRepository.deleteByGuestId(guestId);
        if (submissions == null || submissions.isEmpty()) return;

        Set<UUID> activeQuestionIds = questionRepository.findActiveByCoupleId(coupleId).stream()
                .map(CustomRsvpQuestion::id).collect(Collectors.toSet());

        List<CustomRsvpAnswer> toSave = new ArrayList<>();
        for (CustomAnswerSubmission s : submissions) {
            if (s.answerText() == null || s.answerText().isBlank()) continue;
            if (!activeQuestionIds.contains(s.questionId())) {
                log.warn("custom rsvp answer rejected, unknown or inactive question, coupleId={}, guestId={}, questionId={}",
                        coupleId, guestId, s.questionId());
                continue;
            }
            toSave.add(new CustomRsvpAnswer(null, s.questionId(), guestId, s.answerText().trim(), null, null));
        }
        if (!toSave.isEmpty()) answerRepository.saveAll(toSave);
        log.info("custom rsvp answers saved, coupleId={}, guestId={}, count={}", coupleId, guestId, toSave.size());
    }

    // -----------------------------------------------------------------------
    // Analytics
    // -----------------------------------------------------------------------

    /** Every question with the answers guests gave, for the dashboard analytics. */
    @Transactional(readOnly = true)
    public List<QuestionAnswersResponse> answersForCouple(UUID coupleId) {
        List<CustomRsvpQuestion> questions = questionRepository.findAllByCoupleId(coupleId);
        if (questions.isEmpty()) return List.of();

        Map<UUID, String> guestNames = guestRepository.findAllByCoupleId(coupleId).stream()
                .collect(Collectors.toMap(Guest::id, Guest::name, (a, b) -> a));
        Map<UUID, List<CustomRsvpAnswer>> answersByQuestion = answerRepository
                .findByQuestionIdIn(questions.stream().map(CustomRsvpQuestion::id).toList())
                .stream().collect(Collectors.groupingBy(CustomRsvpAnswer::questionId));

        return questions.stream().map(q -> {
            List<QuestionAnswersResponse.AnswerEntry> entries = answersByQuestion.getOrDefault(q.id(), List.of())
                    .stream()
                    .map(a -> new QuestionAnswersResponse.AnswerEntry(
                            a.guestId(), guestNames.getOrDefault(a.guestId(), "Guest"), a.answerText()))
                    .toList();
            return new QuestionAnswersResponse(q.id(), q.questionText(), q.type(), entries);
        }).toList();
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    // Only CHOICE questions carry options; trim and drop blanks so the editor's empty rows
    // never become phantom choices. Returns an empty list for TEXT/YES_NO.
    private List<String> cleanOptions(CustomQuestionType type, List<String> raw) {
        if (type != CustomQuestionType.CHOICE || raw == null) return List.of();
        return raw.stream()
                .filter(o -> o != null && !o.isBlank())
                .map(String::trim)
                .toList();
    }

    private CustomRsvpQuestion get(UUID coupleId, UUID questionId) {
        return questionRepository.findById(questionId)
                .filter(q -> q.coupleId().equals(coupleId))
                .orElseThrow(() -> new CustomQuestionNotFoundException(questionId.toString()));
    }
}
