package com.altarwed.application.service;

import com.altarwed.application.dto.CeremonySectionRequest;
import com.altarwed.domain.exception.CeremonySectionNotFoundException;
import com.altarwed.domain.model.CeremonySection;
import com.altarwed.domain.port.CeremonySectionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CeremonySectionServiceTest {

    @Mock
    private CeremonySectionRepository repository;

    private CeremonySectionService service;

    @BeforeEach
    void setUp() {
        service = new CeremonySectionService(repository);
    }

    @Test
    void update_whenSectionNotFound_throwsCeremonySectionNotFoundException() {
        UUID coupleId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        when(repository.findById(sectionId)).thenReturn(Optional.empty());

        CeremonySectionRequest req = new CeremonySectionRequest("Title", "READING", "Content", 1);

        assertThatThrownBy(() -> service.update(coupleId, sectionId, req))
                .isInstanceOf(CeremonySectionNotFoundException.class)
                .hasMessageContaining(sectionId.toString());
    }

    @Test
    void update_whenSectionOwnedByDifferentCouple_throwsCeremonySectionNotFoundException() {
        UUID coupleId = UUID.randomUUID();
        UUID otherCoupleId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        CeremonySection otherCouplesSection = new CeremonySection(
                sectionId, otherCoupleId, "Title", "READING", "Content", 1,
                LocalDateTime.now(), LocalDateTime.now());
        when(repository.findById(sectionId)).thenReturn(Optional.of(otherCouplesSection));

        CeremonySectionRequest req = new CeremonySectionRequest("Updated", "READING", "Content", 1);

        assertThatThrownBy(() -> service.update(coupleId, sectionId, req))
                .isInstanceOf(CeremonySectionNotFoundException.class);
    }

    @Test
    void delete_whenSectionNotFound_throwsCeremonySectionNotFoundException() {
        UUID coupleId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        when(repository.findById(sectionId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.delete(coupleId, sectionId))
                .isInstanceOf(CeremonySectionNotFoundException.class)
                .hasMessageContaining(sectionId.toString());
    }
}
