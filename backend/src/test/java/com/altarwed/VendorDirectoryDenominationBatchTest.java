package com.altarwed;

import com.altarwed.application.dto.VendorPageResult;
import com.altarwed.application.service.VendorService;
import com.altarwed.domain.model.Vendor;
import com.altarwed.domain.model.VendorCategory;
import com.altarwed.infrastructure.persistence.entity.VendorEntity;
import com.altarwed.infrastructure.persistence.repository.VendorJpaRepository;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Behavioral proof of issue #380: the public vendor directory must not fire one collection SELECT
 * per row for VendorEntity.denominationIds (an EAGER @ElementCollection). Before the fix,
 * findDirectory returned a page of up to MAX_PAGE_SIZE rows and Hibernate issued 1 query for the
 * page plus one SELECT per vendor to hydrate its denominationIds (the classic N+1). The
 * @BatchSize(50) on the collection collapses those per-row selects into a single batched IN query,
 * so a directory render stays bounded at a small, constant number of statements regardless of how
 * many vendors the page returns.
 *
 * Why this lives next to {@link SchemaValidationTest}: the query-count assertion must run against a
 * real JPA provider and the SQL Server dialect (batch fetching, OFFSET/FETCH paging). H2 or a mock
 * would not prove prod behavior. Tagged "schema-validation" so the default ./gradlew test task skips
 * it and the schemaValidationTest task (real SQL Server container in CI) runs it after Flyway
 * applies every migration.
 *
 * What it asserts (each maps to an acceptance criterion):
 *   1. Query count is bounded and does NOT scale with row count: fetching a full page of vendors
 *      that each carry denomination ids issues at most a small constant number of JDBC statements
 *      (count query + page query + one batched collection load), well below the one-per-row count
 *      the pre-fix N+1 produced.
 *   2. Correctness preserved: every returned vendor still exposes exactly its persisted
 *      denomination ids (the batch fetch must not drop or cross-wire collection data).
 */
@Tag("schema-validation")
@SpringBootTest
@ActiveProfiles("ci")
class VendorDirectoryDenominationBatchTest {

    // Every seeded row carries this email domain and city so cleanup is precise and the directory
    // query can be isolated to exactly this test's rows via the city filter.
    private static final String MARKER_DOMAIN = "@bug380.test";
    private static final String MARKER_CITY = "bug380ville";

    // Enough rows that the pre-fix N+1 statement count (page + one SELECT per row) is unmistakably
    // far from the post-fix bound. 20 rows fit in a single page (size 50 <= MAX_PAGE_SIZE) and stay
    // under MAX_SEARCH_RESULTS, so no boundary trimming interferes with the count.
    private static final int VENDOR_COUNT = 20;
    private static final int DENOMINATIONS_PER_VENDOR = 3;

    // count query + page query + one batched collection load = 3. Allow a little slack for any
    // incidental metadata statement without ever approaching the per-row N+1 (which would be
    // 2 + VENDOR_COUNT = 22 here).
    private static final int MAX_EXPECTED_STATEMENTS = 4;

    @Autowired private VendorJpaRepository jpaRepository;
    @Autowired private VendorService vendorService;
    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private EntityManagerFactory entityManagerFactory;

    @Test
    void directoryPage_batchesDenominationLoads_andReturnsCorrectData() {
        Map<String, List<UUID>> seededDenominations = new java.util.HashMap<>();
        List<VendorEntity> seed = new ArrayList<>();
        for (int i = 0; i < VENDOR_COUNT; i++) {
            String name = String.format("bug380-vendor-%04d", i);
            List<UUID> denominationIds = new ArrayList<>();
            for (int d = 0; d < DENOMINATIONS_PER_VENDOR; d++) {
                denominationIds.add(UUID.randomUUID());
            }
            seededDenominations.put(name, denominationIds);
            seed.add(vendor(name, denominationIds));
        }
        jpaRepository.saveAll(seed);

        try {
            Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
            statistics.setStatisticsEnabled(true);
            statistics.clear();

            // A single page large enough to hold every seeded vendor, filtered to this test's city so
            // no other schema-validation rows dilute the statement count.
            VendorPageResult result = vendorService.getVendors(
                    null, MARKER_CITY, null, "name", 0, 50);

            long prepared = statistics.getPrepareStatementCount();

            // (1) Bounded, N-independent query count. The pre-fix EAGER collection loaded one SELECT
            // per vendor, so this would have been 2 + VENDOR_COUNT statements; the @BatchSize keeps it
            // at the small constant below.
            assertThat(prepared)
                    .as("directory page must issue a bounded, constant number of statements, not one "
                            + "denomination SELECT per vendor (issue #380 N+1)")
                    .isLessThanOrEqualTo(MAX_EXPECTED_STATEMENTS)
                    .isLessThan(VENDOR_COUNT);

            // (2) Correctness: every seeded vendor is returned with exactly its denomination ids.
            List<Vendor> seededVendors = result.vendors().stream()
                    .filter(v -> v.email().endsWith(MARKER_DOMAIN))
                    .toList();
            assertThat(seededVendors)
                    .as("every seeded vendor is returned on the page")
                    .hasSize(VENDOR_COUNT);

            Map<String, List<UUID>> returnedDenominations = seededVendors.stream()
                    .collect(Collectors.toMap(Vendor::businessName,
                            v -> new ArrayList<>(v.denominationIds())));
            assertThat(returnedDenominations.keySet())
                    .as("returned vendor names match the seeded set")
                    .containsExactlyInAnyOrderElementsOf(seededDenominations.keySet());
            returnedDenominations.forEach((name, ids) ->
                    assertThat(ids)
                            .as("vendor %s exposes exactly its persisted denomination ids", name)
                            .containsExactlyInAnyOrderElementsOf(seededDenominations.get(name)));
        } finally {
            jdbcTemplate.update("DELETE FROM vendors WHERE email LIKE ?", "%" + MARKER_DOMAIN);
        }
    }

    private VendorEntity vendor(String businessName, List<UUID> denominationIds) {
        return VendorEntity.builder()
                .businessName(businessName)
                .category(VendorCategory.PHOTOGRAPHER)
                .city(MARKER_CITY)
                .state("TX")
                .email(businessName + MARKER_DOMAIN)
                .passwordHash("hash")
                .isChristianOwned(true)
                .denominationIds(denominationIds)
                .isActive(true)
                .isVerified(true)
                .priceTier("$")
                .viewCount(0)
                .build();
    }
}
