package com.altarwed.application.service;

import com.altarwed.domain.model.Guest;
import com.altarwed.domain.model.GuestRsvpStatus;
import com.altarwed.domain.model.GuestSide;
import com.altarwed.domain.port.CaptchaVerificationPort;
import com.altarwed.domain.port.CoupleRepository;
import com.altarwed.domain.port.GuestRepository;
import com.altarwed.domain.port.RsvpInviteBulkSendRepository;
import com.altarwed.domain.port.RsvpInviteTokenRepository;
import com.altarwed.domain.port.SaveTheDateSendRepository;
import com.altarwed.domain.port.WeddingWebsiteRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link GuestService#exportGuestsCsv} (issue #253).
 *
 * The load-bearing guarantee is column parity: the exported CSV header row must be the EXACT
 * same set and order as the frontend import template (GuestListPage.tsx GUEST_SHEET_COLUMNS,
 * matched by guestImport.ts HEADER_MAP), so what a couple exports round-trips back through the
 * spreadsheet importer and Google Sheet sync. The expected header string below is hardcoded on
 * purpose: it is the contract, and if either side drifts this test fails.
 */
@ExtendWith(MockitoExtension.class)
class GuestExportCsvTest {

    @Mock private GuestRepository guestRepository;
    @Mock private RsvpInviteTokenRepository tokenRepository;
    @Mock private WeddingWebsiteRepository websiteRepository;
    @Mock private CoupleRepository coupleRepository;
    @Mock private AsyncEmailService asyncEmailService;
    @Mock private EmailSuppressionService suppressionService;
    @Mock private CustomRsvpQuestionService customRsvpQuestionService;
    @Mock private CaptchaVerificationPort captchaVerificationPort;
    @Mock private SaveTheDateSendRepository saveTheDateSendRepository;
    @Mock private RsvpInviteBulkSendRepository rsvpInviteBulkSendRepository;

    private static final String EXPECTED_HEADER =
            "Guest Name(s),Party,Side (Bride or Groom),Phone Number,Email Address,"
            + "Street Address,City,State,Zip Code,Country,"
            + "Allowed Plus One?,Plus One Name,RSVP Status,Table #,"
            + "Dietary Restriction,Notes";

    private GuestService service() {
        return new GuestService(guestRepository, tokenRepository, websiteRepository,
                coupleRepository, asyncEmailService, suppressionService, customRsvpQuestionService,
                captchaVerificationPort, saveTheDateSendRepository, rsvpInviteBulkSendRepository);
    }

    @Test
    void exportGuestsCsv_headerMatchesImportTemplateColumns() {
        UUID coupleId = UUID.randomUUID();
        when(guestRepository.findAllByCoupleId(coupleId)).thenReturn(List.of());

        String csv = stripBom(service().exportGuestsCsv(coupleId));
        String[] lines = csv.split("\r\n", -1);

        assertThat(lines[0]).isEqualTo(EXPECTED_HEADER);
    }

    @Test
    void exportGuestsCsv_serializesGuestValuesInColumnOrder() {
        UUID coupleId = UUID.randomUUID();
        Guest guest = guest(coupleId, "Jordan Aasman", "GROOM", GuestRsvpStatus.ATTENDING,
                true, "Alex Aasman", 5, "Nut allergy", "See you there");
        when(guestRepository.findAllByCoupleId(coupleId)).thenReturn(List.of(guest));

        String csv = stripBom(service().exportGuestsCsv(coupleId));
        String[] lines = csv.split("\r\n", -1);

        assertThat(lines[0]).isEqualTo(EXPECTED_HEADER);
        // Column order + value formatting: side/status as enum names, plus-one as Yes, table as a
        // number. These are exactly the string forms the importer normalizes back on the way in.
        assertThat(lines[1]).isEqualTo(
                "Jordan Aasman,Smiths,GROOM,555-0100,jordan@example.com,"
                + "12 Main St,Austin,TX,78701,US,"
                + "Yes,Alex Aasman,ATTENDING,5,"
                + "Nut allergy,See you there");
    }

    @Test
    void exportGuestsCsv_escapesCommasAndQuotesPerRfc4180() {
        UUID coupleId = UUID.randomUUID();
        // A name with a comma and notes with a double-quote must be wrapped and its quotes doubled,
        // otherwise a re-import would split the row into the wrong columns.
        Guest guest = new Guest(
                UUID.randomUUID(), coupleId, "Smith, Jordan", null, null,
                GuestRsvpStatus.PENDING, false, null, null, null,
                null, null, "He said \"yes\"",
                null, null, null, null, null,
                null, 0, null, null, null, null,
                LocalDateTime.now(), LocalDateTime.now(),
                null, null, false, null, false
        );
        when(guestRepository.findAllByCoupleId(coupleId)).thenReturn(List.of(guest));

        String csv = stripBom(service().exportGuestsCsv(coupleId));
        String[] lines = csv.split("\r\n", -1);

        assertThat(lines[1]).startsWith("\"Smith, Jordan\",");
        assertThat(lines[1]).endsWith(",\"He said \"\"yes\"\"\"");
    }

    @Test
    void exportGuestsCsv_neutralizesLeadingFormulaCharacters() {
        UUID coupleId = UUID.randomUUID();
        // A guest controls dietary/notes free text via the public RSVP endpoint. Values beginning
        // with a spreadsheet formula trigger must be prefixed with a single quote so Excel/Sheets
        // treat them as literal text, not a live formula (CSV/formula injection, OWASP-class).
        // dietary is the 15th column, notes the 16th (last).
        Guest guest = guest(coupleId, "Jordan Aasman", "GROOM", GuestRsvpStatus.ATTENDING,
                true, "Alex Aasman", 5, "=SUM(A1:A2)", "@cmd");
        when(guestRepository.findAllByCoupleId(coupleId)).thenReturn(List.of(guest));

        String csv = stripBom(service().exportGuestsCsv(coupleId));
        String[] lines = csv.split("\r\n", -1);

        // No comma/quote/newline in either value, so only the leading-quote prefix applies.
        assertThat(lines[1]).endsWith(",'=SUM(A1:A2),'@cmd");
    }

    @Test
    void exportGuestsCsv_neutralizesEachDangerousLeadingChar() {
        UUID coupleId = UUID.randomUUID();
        // Every trigger character (= + - @) must be neutralized, not just '='.
        assertThat(exportSingleNoteValue(coupleId, "=danger")).isEqualTo("'=danger");
        assertThat(exportSingleNoteValue(coupleId, "+danger")).isEqualTo("'+danger");
        assertThat(exportSingleNoteValue(coupleId, "-danger")).isEqualTo("'-danger");
        assertThat(exportSingleNoteValue(coupleId, "@danger")).isEqualTo("'@danger");
    }

    @Test
    void exportGuestsCsv_leavesNormalValuesUnaffected() {
        UUID coupleId = UUID.randomUUID();
        // A legitimate value not starting with a trigger char is untouched (no leading quote). The
        // guest() helper uses phone 555-0100, which starts with a digit, not '-'.
        Guest guest = guest(coupleId, "Jordan Aasman", "GROOM", GuestRsvpStatus.ATTENDING,
                true, "Alex Aasman", 5, "Nut allergy", "See you there");
        when(guestRepository.findAllByCoupleId(coupleId)).thenReturn(List.of(guest));

        String csv = stripBom(service().exportGuestsCsv(coupleId));
        String[] lines = csv.split("\r\n", -1);

        // Phone (4th col) stays 555-0100, and the free-text tail is unchanged: no stray apostrophe.
        assertThat(lines[1]).isEqualTo(
                "Jordan Aasman,Smiths,GROOM,555-0100,jordan@example.com,"
                + "12 Main St,Austin,TX,78701,US,"
                + "Yes,Alex Aasman,ATTENDING,5,"
                + "Nut allergy,See you there");
    }

    @Test
    void exportGuestsCsv_combinesLeadingQuotePrefixWithRfc4180Escaping() {
        UUID coupleId = UUID.randomUUID();
        // A value that both starts with '=' AND contains a comma must get the leading-quote prefix
        // first, then the whole thing wrapped in RFC-4180 quotes: =1,2 -> '=1,2 -> "'=1,2".
        Guest guest = guest(coupleId, "Jordan Aasman", "GROOM", GuestRsvpStatus.ATTENDING,
                true, "Alex Aasman", 5, "Nut allergy", "=1,2");
        when(guestRepository.findAllByCoupleId(coupleId)).thenReturn(List.of(guest));

        String csv = stripBom(service().exportGuestsCsv(coupleId));
        String[] lines = csv.split("\r\n", -1);

        assertThat(lines[1]).endsWith(",\"'=1,2\"");
    }

    private String exportSingleNoteValue(UUID coupleId, String noteValue) {
        Guest guest = guest(coupleId, "Jordan Aasman", "GROOM", GuestRsvpStatus.ATTENDING,
                true, "Alex Aasman", 5, "Nut allergy", noteValue);
        when(guestRepository.findAllByCoupleId(coupleId)).thenReturn(List.of(guest));
        String csv = stripBom(service().exportGuestsCsv(coupleId));
        String[] lines = csv.split("\r\n", -1);
        String row = lines[1];
        // Notes is the last column; return just that field.
        return row.substring(row.lastIndexOf(',') + 1);
    }

    @Test
    void exportGuestsCsv_prependsUtf8Bom() {
        UUID coupleId = UUID.randomUUID();
        when(guestRepository.findAllByCoupleId(coupleId)).thenReturn(List.of());

        String csv = service().exportGuestsCsv(coupleId);

        assertThat(csv).startsWith("\uFEFF");
    }

    private static String stripBom(String s) {
        return s.startsWith("\uFEFF") ? s.substring(1) : s;
    }

    private static Guest guest(UUID coupleId, String name, String side, GuestRsvpStatus status,
                               boolean plusOneAllowed, String plusOneName, Integer tableNumber,
                               String dietary, String notes) {
        return new Guest(
                UUID.randomUUID(), coupleId, name, "jordan@example.com", "555-0100",
                status, plusOneAllowed, plusOneName, dietary, null,
                tableNumber, GuestSide.valueOf(side), notes,
                "12 Main St", "Austin", "TX", "78701", "US",
                null, 0, null, null, null, null,
                LocalDateTime.now(), LocalDateTime.now(),
                null, "Smiths", false, null, false
        );
    }
}
