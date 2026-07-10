package com.altarwed.application.service;

import com.altarwed.application.dto.CreateSeatingTableRequest;
import com.altarwed.application.dto.UpdateSeatingTableRequest;
import com.altarwed.domain.exception.SeatingTableNotFoundException;
import com.altarwed.domain.model.Guest;
import com.altarwed.domain.model.SeatingTable;
import com.altarwed.domain.port.GuestRepository;
import com.altarwed.domain.port.SeatingTableRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class SeatingTableService {

    private static final Logger log = LoggerFactory.getLogger(SeatingTableService.class);

    private final SeatingTableRepository repository;
    private final GuestRepository guestRepository;

    public SeatingTableService(SeatingTableRepository repository, GuestRepository guestRepository) {
        this.repository = repository;
        this.guestRepository = guestRepository;
    }

    @Transactional(readOnly = true)
    public List<SeatingTable> list(UUID coupleId) {
        return repository.findAllByCoupleId(coupleId);
    }

    @Transactional
    public SeatingTable create(UUID coupleId, CreateSeatingTableRequest req) {
        int nextSort = repository.findAllByCoupleId(coupleId).stream()
                .mapToInt(SeatingTable::sortOrder)
                .max()
                .orElse(-1) + 1;
        int capacity = req.capacity() != null ? req.capacity() : 8;
        SeatingTable table = new SeatingTable(null, coupleId, req.name(), capacity, nextSort, null, null);
        SeatingTable saved = repository.save(table);
        log.info("seating table created, coupleId={}, tableId={}", coupleId, saved.id());
        return saved;
    }

    @Transactional
    public SeatingTable update(UUID coupleId, UUID tableId, UpdateSeatingTableRequest req) {
        SeatingTable existing = get(coupleId, tableId);
        SeatingTable updated = new SeatingTable(
                existing.id(), existing.coupleId(),
                req.name()      != null ? req.name()      : existing.name(),
                req.capacity()  != null ? req.capacity()  : existing.capacity(),
                req.sortOrder() != null ? req.sortOrder() : existing.sortOrder(),
                existing.createdAt(), LocalDateTime.now()
        );
        SeatingTable saved = repository.save(updated);
        log.info("seating table updated, coupleId={}, tableId={}", coupleId, saved.id());
        return saved;
    }

    /**
     * A guest's seat is stored as a 1-based tableNumber that the UI resolves POSITIONALLY against
     * the couple's tables ordered by sortOrder (assignment writes tables.indexOf(target)+1; the
     * board reads tables[tableNumber-1]). So deleting a table at position P compacts that list and
     * silently shifts every guest seated at a later table onto the wrong table, and drops guests
     * seated at P off the end, with no message. This corrupts the printed "find your seat" board.
     *
     * Until the seat reference is made a stable table id (the real fix, tracked separately), keep
     * the positional model self-consistent on delete: in the SAME transaction, reindex the couple's
     * guests to match the compacted list. Guests seated at the deleted table become explicitly
     * unassigned (tableNumber=null); guests seated after it shift down by one. A reorder via
     * update(sortOrder) is a separate vector this does NOT cover and still wants the stable-id fix.
     */
    @Transactional
    public void delete(UUID coupleId, UUID tableId) {
        // Load in the SAME sortOrder-ascending order the UI uses, so "position" here means exactly
        // what the couple sees on the board. Doubles as the ownership + existence check.
        List<SeatingTable> ordered = repository.findAllByCoupleId(coupleId);
        int position = -1; // 1-based position of the table being deleted
        for (int i = 0; i < ordered.size(); i++) {
            if (ordered.get(i).id().equals(tableId)) {
                position = i + 1;
                break;
            }
        }
        if (position == -1) {
            throw new SeatingTableNotFoundException(tableId.toString());
        }

        repository.deleteById(tableId);

        List<Guest> guests = guestRepository.findAllByCoupleId(coupleId);
        List<Guest> reseated = new ArrayList<>();
        int unassigned = 0;
        int shifted = 0;
        for (Guest g : guests) {
            Integer tn = g.tableNumber();
            if (tn == null) continue;
            if (tn == position) {
                reseated.add(withTableNumber(g, null));
                unassigned++;
            } else if (tn > position) {
                reseated.add(withTableNumber(g, tn - 1));
                shifted++;
            }
            // tn < position: unaffected by the compaction, leave as-is.
        }
        if (!reseated.isEmpty()) {
            guestRepository.saveAll(reseated);
        }

        log.info("seating table deleted, coupleId={}, tableId={}, position={}, guestsUnassigned={}, guestsShifted={}",
                coupleId, tableId, position, unassigned, shifted);
    }

    // Copy of a guest with only tableNumber changed. Guest is an immutable record with no wither,
    // so every field is threaded through; keep in sync if the record gains fields.
    private static Guest withTableNumber(Guest g, Integer tableNumber) {
        return new Guest(
                g.id(), g.coupleId(), g.name(), g.email(), g.phone(), g.rsvpStatus(),
                g.plusOneAllowed(), g.plusOneName(), g.dietaryRestrictions(), g.songRequest(),
                tableNumber, g.side(), g.notes(),
                g.mailLine1(), g.mailCity(), g.mailState(), g.mailZip(), g.mailCountry(),
                g.noteForCouple(), g.inviteSendCount(), g.inviteSentAt(), g.saveTheDateSentAt(),
                g.respondedAt(), g.remindAt(), g.createdAt(), g.updatedAt(),
                g.partyId(), g.partyName(), g.partyContact(), g.sheetSyncId(), g.syncedFromSheet()
        );
    }

    private SeatingTable get(UUID coupleId, UUID tableId) {
        return repository.findById(tableId)
                .filter(t -> t.coupleId().equals(coupleId))
                .orElseThrow(() -> new SeatingTableNotFoundException(tableId.toString()));
    }
}
