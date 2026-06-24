package com.altarwed.application.service;

import com.altarwed.application.dto.CreateSeatingTableRequest;
import com.altarwed.domain.model.SeatingTable;
import com.altarwed.domain.port.SeatingTableRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SeatingTableServiceTest {

    @Mock private SeatingTableRepository repository;

    private SeatingTableService service() {
        return new SeatingTableService(repository);
    }

    private SeatingTable table(UUID coupleId, int sortOrder) {
        return new SeatingTable(UUID.randomUUID(), coupleId, "Table", 8, sortOrder, null, null);
    }

    @Test
    void create_derivesSortOrderFromMaxPlusOne_afterMiddleDelete() {
        UUID coupleId = UUID.randomUUID();
        when(repository.findAllByCoupleId(coupleId))
                .thenReturn(List.of(table(coupleId, 0), table(coupleId, 2)));
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service().create(coupleId, new CreateSeatingTableRequest("Head Table", 10));

        ArgumentCaptor<SeatingTable> saved = ArgumentCaptor.forClass(SeatingTable.class);
        verify(repository).save(saved.capture());
        assertThat(saved.getValue().sortOrder()).isEqualTo(3);
    }

    @Test
    void create_usesSortOrderZero_forFirstTable() {
        UUID coupleId = UUID.randomUUID();
        when(repository.findAllByCoupleId(coupleId)).thenReturn(List.of());
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service().create(coupleId, new CreateSeatingTableRequest("Sweetheart", 2));

        ArgumentCaptor<SeatingTable> saved = ArgumentCaptor.forClass(SeatingTable.class);
        verify(repository).save(saved.capture());
        assertThat(saved.getValue().sortOrder()).isZero();
    }
}
