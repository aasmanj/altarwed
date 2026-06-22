package com.altarwed.web.controller;

import com.altarwed.application.dto.CreateCustomQuestionRequest;
import com.altarwed.application.dto.CustomQuestionResponse;
import com.altarwed.application.dto.QuestionAnswersResponse;
import com.altarwed.application.dto.UpdateCustomQuestionRequest;
import com.altarwed.application.service.CustomRsvpQuestionService;
import com.altarwed.domain.model.CustomRsvpQuestion;
import com.altarwed.web.security.CoupleAccessGuard;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/custom-rsvp-questions")
public class CustomRsvpQuestionController {

    private final CustomRsvpQuestionService service;
    private final CoupleAccessGuard accessGuard;

    public CustomRsvpQuestionController(CustomRsvpQuestionService service, CoupleAccessGuard accessGuard) {
        this.service = service;
        this.accessGuard = accessGuard;
    }

    @GetMapping("/couple/{coupleId}")
    public ResponseEntity<List<CustomQuestionResponse>> list(
            @PathVariable UUID coupleId,
            @AuthenticationPrincipal String email
    ) {
        accessGuard.assertOwns(coupleId, email);
        return ResponseEntity.ok(service.list(coupleId).stream().map(this::toResponse).toList());
    }

    @PostMapping("/couple/{coupleId}")
    public ResponseEntity<CustomQuestionResponse> create(
            @PathVariable UUID coupleId,
            @Valid @RequestBody CreateCustomQuestionRequest request,
            @AuthenticationPrincipal String email
    ) {
        accessGuard.assertOwns(coupleId, email);
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(service.create(coupleId, request)));
    }

    @PatchMapping("/couple/{coupleId}/{questionId}")
    public ResponseEntity<CustomQuestionResponse> update(
            @PathVariable UUID coupleId,
            @PathVariable UUID questionId,
            @Valid @RequestBody UpdateCustomQuestionRequest request,
            @AuthenticationPrincipal String email
    ) {
        accessGuard.assertOwns(coupleId, email);
        return ResponseEntity.ok(toResponse(service.update(coupleId, questionId, request)));
    }

    @DeleteMapping("/couple/{coupleId}/{questionId}")
    public ResponseEntity<Void> delete(
            @PathVariable UUID coupleId,
            @PathVariable UUID questionId,
            @AuthenticationPrincipal String email
    ) {
        accessGuard.assertOwns(coupleId, email);
        service.delete(coupleId, questionId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/couple/{coupleId}/answers")
    public ResponseEntity<List<QuestionAnswersResponse>> answers(
            @PathVariable UUID coupleId,
            @AuthenticationPrincipal String email
    ) {
        accessGuard.assertOwns(coupleId, email);
        return ResponseEntity.ok(service.answersForCouple(coupleId));
    }

    private CustomQuestionResponse toResponse(CustomRsvpQuestion q) {
        return new CustomQuestionResponse(
                q.id(), q.coupleId(), q.questionText(), q.type(),
                q.options(), q.required(), q.sortOrder(), q.active());
    }
}
