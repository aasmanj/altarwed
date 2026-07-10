package com.altarwed.application.service;

import com.altarwed.application.dto.CreateSeatingTableRequest;
import com.altarwed.domain.exception.SeatingTableNotFoundException;
import com.altarwed.domain.model.SeatingTable;
import com.altarwed.domain.port.GuestRepository;
import com.altarwed.domain.port.SeatingTableRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SeatingTableServiceTest {

    @Mock private SeatingTableRepository repository;
    @Mock private GuestRepository guestRepository;

    private SeatingTableService service() {
        return new SeatingTableService(repository, guestRepository);
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

    // ── delete: reindex guests (two bulk UPDATEs) so a mid-list delete never scrambles the board ──

    @Test
    void delete_reindexesGuests_atTheDeletedPosition_unassignBeforeShift() {
        UUID coupleId = UUID.randomUUID();
        // Tables at positions 1, 2, 3 (sortOrder asc). Delete the middle one (position 2).
        SeatingTable t1 = table(coupleId, 0);
        SeatingTable t2 = table(coupleId, 1);
        SeatingTable t3 = table(coupleId, 2);
        when(repository.findAllByCoupleId(coupleId)).thenReturn(List.of(t1, t2, t3));

        service().delete(coupleId, t2.id());

        // Delete the row, then reindex at position 2. The unassign MUST precede the shift: reversed,
        // the shift would move a guest into position 2 that the unassign then wrongly nulls.
        InOrder ordered = inOrder(repository, guestRepository);
        ordered.verify(repository).deleteById(t2.id());
        ordered.verify(guestRepository).unassignGuestsAtTablePosition(coupleId, 2);
        ordered.verify(guestRepository).shiftGuestsAfterTablePosition(coupleId, 2);
    }

    @Test
    void delete_usesTheCorrectPosition_forFirstAndLastTable() {
        UUID coupleId = UUID.randomUUID();
        SeatingTable t1 = table(coupleId, 0);
        SeatingTable t2 = table(coupleId, 1);
        SeatingTable t3 = table(coupleId, 2);
        when(repository.findAllByCoupleId(coupleId)).thenReturn(List.of(t1, t2, t3));

        service().delete(coupleId, t1.id()); // first table -> position 1
        verify(guestRepository).unassignGuestsAtTablePosition(coupleId, 1);
        verify(guestRepository).shiftGuestsAfterTablePosition(coupleId, 1);

        service().delete(coupleId, t3.id()); // last table -> position 3 (nothing after it to shift)
        verify(guestRepository).unassignGuestsAtTablePosition(coupleId, 3);
        verify(guestRepository).shiftGuestsAfterTablePosition(coupleId, 3);
    }

    @Test
    void delete_throwsAndTouchesNothing_whenTableNotOwnedByCouple() {
        UUID coupleId = UUID.randomUUID();
        when(repository.findAllByCoupleId(coupleId)).thenReturn(List.of(table(coupleId, 0)));

        assertThatThrownBy(() -> service().delete(coupleId, UUID.randomUUID()))
                .isInstanceOf(SeatingTableNotFoundException.class);
        verify(repository, never()).deleteById(any());
        verify(guestRepository, never()).unassignGuestsAtTablePosition(any(), anyInt());
        verify(guestRepository, never()).shiftGuestsAfterTablePosition(any(), anyInt());
    }
}
