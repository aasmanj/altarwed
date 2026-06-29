package com.altarwed;

import com.altarwed.infrastructure.persistence.entity.CustomRsvpAnswerEntity;
import com.altarwed.infrastructure.persistence.repository.CustomRsvpAnswerJpaRepository;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Verifies the V74 additive index on custom_rsvp_answers(guest_id).
 *
 * Why this lives next to {@link SchemaValidationTest}: it needs a real SQL Server
 * dialect (sys.indexes is a SQL Server system catalog view; H2 has no equivalent).
 * It is tagged "schema-validation" so the default ./gradlew test task skips it and
 * the schemaValidationTest task (which boots a real SQL Server container in CI)
 * runs it after Flyway has applied every migration through V74.
 *
 * What it asserts:
 *   1. The index idx_custom_rsvp_answers_guest exists after migrations apply.
 *   2. findByGuestId / deleteByGuestId still round-trip against the live schema,
 *      proving the index migration introduced no regression on the busiest public
 *      RSVP write path.
 */
@Tag("schema-validation")
@SpringBootTest
@ActiveProfiles("ci")
class CustomRsvpAnswerGuestIndexTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private CustomRsvpAnswerJpaRepository answerRepository;

    @Test
    void guestIndexExistsAfterMigration() {
        // sys.indexes is queried by name; the V74 migration is the only thing that
        // creates an index with this name. A table scan (no index) would return 0.
        Integer matches = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM sys.indexes WHERE name = 'idx_custom_rsvp_answers_guest'",
                Integer.class);

        assertThat(matches)
                .as("V74 must create idx_custom_rsvp_answers_guest")
                .isEqualTo(1);

        // Confirm it is the guest_id column the index keys on, not some unrelated index
        // that happens to share the name. index_columns -> columns resolves the key column.
        String indexedColumn = jdbcTemplate.queryForObject(
                """
                SELECT c.name
                FROM sys.indexes i
                JOIN sys.index_columns ic
                  ON ic.object_id = i.object_id AND ic.index_id = i.index_id
                JOIN sys.columns c
                  ON c.object_id = ic.object_id AND c.column_id = ic.column_id
                WHERE i.name = 'idx_custom_rsvp_answers_guest'
                """,
                String.class);

        assertThat(indexedColumn)
                .as("idx_custom_rsvp_answers_guest must key on guest_id")
                .isEqualTo("guest_id");
    }

    @Test
    void findAndDeleteByGuestIdRoundTrip() {
        // Build the FK chain custom_rsvp_answers -> guests -> couples and
        // custom_rsvp_answers -> custom_rsvp_questions -> couples. SQL Server
        // implicitly converts the string-bound parameters to UNIQUEIDENTIFIER.
        UUID coupleId = UUID.randomUUID();
        UUID guestId = UUID.randomUUID();
        UUID questionId = UUID.randomUUID();

        jdbcTemplate.update(
                "INSERT INTO couples (id, partner_one_name, partner_two_name, email, password_hash) "
                        + "VALUES (?, ?, ?, ?, ?)",
                coupleId.toString(), "Partner One", "Partner Two",
                "rsvp-index-test-" + coupleId + "@example.test", "hash");

        jdbcTemplate.update(
                "INSERT INTO guests (id, couple_id, name) VALUES (?, ?, ?)",
                guestId.toString(), coupleId.toString(), "Index Test Guest");

        jdbcTemplate.update(
                "INSERT INTO custom_rsvp_questions (id, couple_id, question_text, question_type) "
                        + "VALUES (?, ?, ?, ?)",
                questionId.toString(), coupleId.toString(), "Will you attend?", "YES_NO");

        try {
            CustomRsvpAnswerEntity answer = CustomRsvpAnswerEntity.builder()
                    .questionId(questionId)
                    .guestId(guestId)
                    .answerText("Yes")
                    .build();
            answerRepository.saveAndFlush(answer);

            // findByGuestId, the dashboard analytics read path, returns the saved answer.
            List<CustomRsvpAnswerEntity> found = answerRepository.findByGuestId(guestId);
            assertThat(found)
                    .as("findByGuestId must return the saved answer")
                    .hasSize(1);
            assertThat(found.get(0).getAnswerText()).isEqualTo("Yes");

            // deleteByGuestId, called on every public RSVP submit, removes it.
            answerRepository.deleteByGuestId(guestId);
            assertThat(answerRepository.findByGuestId(guestId))
                    .as("deleteByGuestId must remove the answer")
                    .isEmpty();
        } finally {
            // Deleting the couple cascades couples -> guests and couples -> questions,
            // leaving the throwaway CI database clean for any other migration tests.
            jdbcTemplate.update("DELETE FROM couples WHERE id = ?", coupleId.toString());
        }
    }
}
