package com.altarwed;

import com.altarwed.domain.model.WeddingWebsiteSummary;
import com.altarwed.domain.port.WeddingWebsiteRepository;
import com.altarwed.infrastructure.persistence.entity.WeddingWebsiteEntity;
import com.altarwed.infrastructure.persistence.repository.WeddingWebsiteJpaRepository;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Behavioral proof of issue #152: the /published sitemap path must select only slug + updatedAt,
 * never hydrate the full WeddingWebsiteEntity (hero text, vows, every column).
 *
 * Why this lives next to {@link SchemaValidationTest}: the closed interface projection only
 * restricts the generated SQL columns against a real JPA provider + SQL Server dialect; an
 * in-memory mock could not prove that no full entity is loaded. Tagged "schema-validation" so the
 * default ./gradlew test task skips it and the schemaValidationTest task (real SQL Server container
 * in CI) runs it after Flyway applies every migration.
 *
 * What it asserts (each maps to an acceptance criterion):
 *   1. Contract unchanged: findPublishedSummaries() returns one (slug, updatedAt) per published,
 *      non-deleted site, and excludes unpublished and soft-deleted sites.
 *   2. No full-entity hydration: Hibernate's entity-load counter stays at zero across the query
 *      even though rows are returned. Before the fix (findAll...() returning full entities) this
 *      counter would equal the number of published rows.
 */
@Tag("schema-validation")
@SpringBootTest
@ActiveProfiles("ci")
class PublishedWeddingWebsiteProjectionTest {

    // Every seeded row carries this slug prefix so cleanup is precise and this test never
    // collides with rows any other schema-validation test might create.
    private static final String MARKER = "bug152-";

    @Autowired private WeddingWebsiteRepository websiteRepository;
    @Autowired private WeddingWebsiteJpaRepository jpaRepository;
    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private EntityManagerFactory entityManagerFactory;

    @Test
    void findPublishedSummaries_returnsSlimContract_andHydratesNoFullEntity() {
        // wedding_websites.couple_id has fk_wedding_websites_couple -> couples(id), and
        // uq_wedding_websites_couple is UNIQUE on couple_id, so each of the four sites needs
        // its own real couple row, not a bare UUID.randomUUID(). Declared before the try so
        // finally can always reach them, but seeded inside it so a failure mid-seed still
        // cleans up whatever was inserted rather than orphaning rows on repeated local runs.
        UUID coupleA = null;
        UUID coupleB = null;
        UUID coupleUnpublished = null;
        UUID coupleDeleted = null;
        try {
            coupleA = seedCouple();
            coupleB = seedCouple();
            coupleUnpublished = seedCouple();
            coupleDeleted = seedCouple();

            WeddingWebsiteEntity publishedA = jpaRepository.save(site(coupleA, MARKER + "published-a", true, false));
            WeddingWebsiteEntity publishedB = jpaRepository.save(site(coupleB, MARKER + "published-b", true, false));
            jpaRepository.save(site(coupleUnpublished, MARKER + "unpublished", false, false));
            jpaRepository.save(site(coupleDeleted, MARKER + "deleted", true, true));

            Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
            statistics.setStatisticsEnabled(true);
            statistics.clear();

            List<WeddingWebsiteSummary> summaries = websiteRepository.findPublishedSummaries();

            List<WeddingWebsiteSummary> seeded = summaries.stream()
                    .filter(s -> s.slug().startsWith(MARKER))
                    .toList();

            // (1) Contract: only the two published, non-deleted sites, each with slug + updatedAt.
            assertThat(seeded)
                    .as("only published, non-deleted sites are returned")
                    .extracting(WeddingWebsiteSummary::slug)
                    .containsExactlyInAnyOrder(MARKER + "published-a", MARKER + "published-b");
            // Truncate both sides to microseconds before comparing: the in-memory LocalDateTime set
            // by @PrePersist keeps full nanosecond precision on a Linux CI JVM, while the value read
            // back through the projection is rounded by SQL Server's DATETIME2 (100ns) column. Exact
            // equality can intermittently mismatch on those sub-microsecond digits; truncating to
            // MICROS still proves the persisted timestamp round-trips without the flake.
            assertThat(seeded)
                    .as("each summary carries the persisted updatedAt")
                    .extracting(s -> s.updatedAt().truncatedTo(ChronoUnit.MICROS))
                    .containsExactlyInAnyOrder(
                            publishedA.getUpdatedAt().truncatedTo(ChronoUnit.MICROS),
                            publishedB.getUpdatedAt().truncatedTo(ChronoUnit.MICROS));

            // (2) No full entity was loaded: the projection selected only slug + updated_at. The old
            // findAll...() returning full entities would push this counter to the published-row count.
            assertThat(statistics.getEntityLoadCount())
                    .as("the sitemap projection must not hydrate any WeddingWebsiteEntity")
                    .isZero();
        } finally {
            // wedding_websites first: fk_wedding_websites_couple has ON DELETE CASCADE, but
            // deleting couples first would already cascade-remove the sites anyway. Being
            // explicit keeps the cleanup order obvious regardless of the FK's cascade rule.
            jdbcTemplate.update("DELETE FROM wedding_websites WHERE slug LIKE ?", MARKER + "%");
            // Arrays.asList, not List.of: List.of throws on a null element, and a failure
            // mid-seed (e.g. the second seedCouple() throws) legitimately leaves some of these
            // null. Cleaning up whatever couples DID get created must not NPE either way.
            for (UUID coupleId : java.util.Arrays.asList(coupleA, coupleB, coupleUnpublished, coupleDeleted)) {
                if (coupleId == null) continue;
                jdbcTemplate.update("DELETE FROM couples WHERE id = ?", coupleId.toString());
            }
        }
    }

    private UUID seedCouple() {
        UUID coupleId = UUID.randomUUID();
        jdbcTemplate.update(
                "INSERT INTO couples (id, partner_one_name, partner_two_name, email, password_hash) "
                        + "VALUES (?, ?, ?, ?, ?)",
                coupleId.toString(), "Partner One", "Partner Two",
                MARKER + coupleId + "@example.test", "hash");
        return coupleId;
    }

    private WeddingWebsiteEntity site(UUID coupleId, String slug, boolean published, boolean deleted) {
        return WeddingWebsiteEntity.builder()
                .coupleId(coupleId)
                .slug(slug)
                .isPublished(published)
                .partnerOneName("Partner One")
                .partnerTwoName("Partner Two")
                .isDeleted(deleted)
                .build();
    }
}
