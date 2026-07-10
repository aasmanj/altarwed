package com.altarwed.application.service;

import com.altarwed.application.dto.CreateSeatingTableRequest;
import com.altarwed.domain.exception.SeatingTableNotFoundException;
import com.altarwed.domain.model.Guest;
import com.altarwed.domain.model.GuestRsvpStatus;
import com.altarwed.domain.model.SeatingTable;
import com.altarwed.domain.port.GuestRepository;
import com.altarwed.domain.port.SeatingTableRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
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

    // Guest with only the fields the seating reindex touches; everything else defaulted.
    private Guest guestAtTable(UUID coupleId, String name, Integer tableNumber) {
        return new Guest(
                UUID.randomUUID(), coupleId, name, null, null, GuestRsvpStatus.PENDING,
                false, null, null, null, tableNumber, null, null,
                null, null, null, null, null, null, 0, null, null, null, null, null, null,
                null, null, null, null, false);
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

    // ── delete: reindex guests so a mid-list delete never scrambles the seating board ──

    @Test
    void delete_reindexesGuests_afterMiddleTableRemoved() {
        UUID coupleId = UUID.randomUUID();
        // Tables at positions 1, 2, 3 (sortOrder asc). Delete the middle one (position 2).
        SeatingTable t1 = table(coupleId, 0);
        SeatingTable t2 = table(coupleId, 1);
        SeatingTable t3 = table(coupleId, 2);
        when(repository.findAllByCoupleId(coupleId)).thenReturn(List.of(t1, t2, t3));

        Guest atT1 = guestAtTable(coupleId, "Anna", 1);   // before deleted -> unchanged
        Guest atT2 = guestAtTable(coupleId, "Ben", 2);    // at deleted     -> unassigned (null)
        Guest atT3 = guestAtTable(coupleId, "Cara", 3);   // after deleted  -> shifts to 2
        Guest unseated = guestAtTable(coupleId, "Dan", null); // untouched
        when(guestRepository.findAllByCoupleId(coupleId)).thenReturn(List.of(atT1, atT2, atT3, unseated));

        service().delete(coupleId, t2.id());

        verify(repository).deleteById(t2.id());
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<Guest>> captor = ArgumentCaptor.forClass(List.class);
        verify(guestRepository).saveAll(captor.capture());
        // Build the map manually: Collectors.toMap rejects null values, and a null tableNumber
        // (the unassigned guest) is exactly what we need to assert on.
        Map<String, Integer> byName = new java.util.HashMap<>();
        captor.getValue().forEach(g -> byName.put(g.name(), g.tableNumber()));
        // Only the affected guests are written; the before-guest and the unseated guest are not.
        assertThat(byName).containsOnlyKeys("Ben", "Cara");
        assertThat(byName.get("Ben")).isNull();   // was at the deleted table -> unassigned
        assertThat(byName.get("Cara")).isEqualTo(2); // shifted down from 3 to 2
    }

    @Test
    void delete_writesNoGuests_whenNoneAreSeatedAtOrAfterTheDeletedTable() {
        UUID coupleId = UUID.randomUUID();
        SeatingTable t1 = table(coupleId, 0);
        SeatingTable t2 = table(coupleId, 1);
        when(repository.findAllByCoupleId(coupleId)).thenReturn(List.of(t1, t2));
        // Delete the LAST table (position 2); only a guest before it and an unseated guest exist.
        when(guestRepository.findAllByCoupleId(coupleId))
                .thenReturn(List.of(guestAtTable(coupleId, "Anna", 1), guestAtTable(coupleId, "Dan", null)));

        service().delete(coupleId, t2.id());

        verify(repository).deleteById(t2.id());
        verify(guestRepository, never()).saveAll(any());
    }

    @Test
    void delete_throwsAndTouchesNothing_whenTableNotOwnedByCouple() {
        UUID coupleId = UUID.randomUUID();
        when(repository.findAllByCoupleId(coupleId)).thenReturn(List.of(table(coupleId, 0)));

        assertThatThrownBy(() -> service().delete(coupleId, UUID.randomUUID()))
                .isInstanceOf(SeatingTableNotFoundException.class);
        verify(repository, never()).deleteById(any());
        verify(guestRepository, never()).saveAll(any());
    }
}
