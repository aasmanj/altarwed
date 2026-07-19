package com.altarwed;

import com.altarwed.application.dto.VendorPageResult;
import com.altarwed.application.service.VendorService;
import com.altarwed.domain.model.Vendor;
import com.altarwed.domain.model.VendorCategory;
import com.altarwed.infrastructure.persistence.entity.VendorEntity;
import com.altarwed.infrastructure.persistence.repository.VendorJpaRepository;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Behavioral proof of issue #135: the public vendor directory's sort, price-tier filter, and
 * paging run in the database, so they operate over the FULL matched set, not an alphabetically
 * first 100-row prefix that the old code sorted/filtered in memory.
 *
 * Why this lives next to {@link SchemaValidationTest}: it needs a real SQL Server (the ORDER BY
 * view_count DESC + OFFSET/FETCH and the "(:x IS NULL OR ...)" dynamic filter must execute against
 * the real dialect; H2 would not prove prod behavior). It is tagged "schema-validation" so the
 * default ./gradlew test task skips it and the schemaValidationTest task (real SQL Server container
 * in CI) runs it after Flyway applies every migration through V79.
 *
 * What it asserts (each maps to an acceptance criterion):
 *   1. With >100 active+verified vendors seeded, the most-viewed vendor whose business_name sorts
 *      AFTER position 100 appears on page 0 of the default (most-viewed) sort. Under the old
 *      name-ordered 100-row cap this vendor was truncated out of the candidate set and never
 *      surfaced on any page.
 *   2. A price-tier filter returns the correct total across ALL matching vendors, not a count
 *      bounded by a 100-row name prefix (the old code would have reported 0 here).
 *   3. The V79 additive index ix_vendors_directory_default exists after migrations apply.
 */
@Tag("schema-validation")
@SpringBootTest
@ActiveProfiles("ci")
class VendorDirectoryQueryTest {

    // Every seeded row carries this email domain so cleanup is precise and this test never
    // collides with rows any other schema-validation test might create.
    private static final String MARKER_DOMAIN = "@bug135.test";
    private static final String SURFACER_NAME = "zzz-bug135-surfacer";

    @Autowired private VendorJpaRepository jpaRepository;
    @Autowired private VendorService vendorService;
    @Autowired private JdbcTemplate jdbcTemplate;

    @Test
    void mostViewedVendorPastPositionOneHundredSurfaces_andTierTotalsAreCorrect() {
        List<VendorEntity> seed = new ArrayList<>();
        // 130 "$" vendors named "aaa-..." so they occupy the first 130 slots of a name sort, which
        // is exactly the prefix the old code truncated the candidate set to.
        for (int i = 0; i < 130; i++) {
            seed.add(vendor(String.format("aaa-bug135-%04d", i), "$", i));
        }
        // 3 "$$" vendors named "zzz-..." so they sort AFTER position 100: the old tier filter,
        // running over the first-100-by-name prefix, could never see them (would report 0).
        for (int i = 0; i < 3; i++) {
            seed.add(vendor(String.format("zzz-bug135-tier-%d", i), "$$", 5));
        }
        // The most-viewed vendor, also named "zzz-..." (sorts last), so the default popularity sort
        // must reach past the name prefix to surface it at the top.
        seed.add(vendor(SURFACER_NAME, "$", 1_000_000_000));
        jpaRepository.saveAll(seed);

        try {
            // (1) Default sort = most-viewed first. The surfacer must appear on page 0 despite its
            // name sorting after position 100. It has the highest view count, so it ranks first.
            VendorPageResult defaultPage0 = vendorService.getVendors(null, null, null, null, 0, 20);
            assertThat(defaultPage0.vendors())
                    .as("most-viewed vendor sorting after position 100 must appear on page 0 of the default sort")
                    .extracting(Vendor::businessName)
                    .contains(SURFACER_NAME);
            assertThat(defaultPage0.vendors().get(0).businessName())
                    .as("the single highest view_count vendor must rank first in the default sort")
                    .isEqualTo(SURFACER_NAME);

            // (2) Tier filter total across the whole matched set, not a 100-row prefix. Compare to a
            // direct SQL COUNT of the same predicate so the assertion is exact regardless of any
            // other rows, and confirm it is the 3 we seeded (the old code would have reported 0).
            Integer expectedTier = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM vendors WHERE is_active = 1 AND is_verified = 1 AND price_tier = '$$'",
                    Integer.class);
            VendorPageResult tierPage = vendorService.getVendors(null, null, "$$", "name", 0, 20);
            assertThat(tierPage.total())
                    .as("price-tier total must count all matching vendors, not a 100-row name prefix")
                    .isEqualTo(expectedTier)
                    .isEqualTo(3);
            assertThat(tierPage.vendors())
                    .as("the '$$' vendors sorting after position 100 must be returned by the tier filter")
                    .extracting(Vendor::businessName)
                    .contains("zzz-bug135-tier-0", "zzz-bug135-tier-1", "zzz-bug135-tier-2");
        } finally {
            jdbcTemplate.update("DELETE FROM vendors WHERE email LIKE ?", "%" + MARKER_DOMAIN);
        }
    }

    /**
     * Issue #370 pricing ladder: a vendor with a live PREMIUM subscription is pinned to the top
     * of the directory (top-of-category placement, the tier's headline paid differentiator), in
     * both the default popularity sort and the alphabetical sort, ahead of vendors with far more
     * views. A CANCELLED premium subscription confers no placement. Runs against real SQL Server
     * because the ORDER BY CASE WHEN EXISTS(...) correlated subquery must be proven on the prod
     * dialect, and the placement must hold in the database (across pagination), not in memory.
     */
    @Test
    void activePremiumVendorRanksFirstInBothSorts_cancelledPremiumDoesNot() {
        String premiumName = "zzz-issue370-premium";
        String cancelledName = "aaa-issue370-cancelled";
        String popularName = "mmm-issue370-popular";
        // A city only this test seeds, so the assertions are isolated from rows any other
        // schema-validation test leaves behind and all three rows fit on page 0.
        String city = "issue370ville";
        List<VendorEntity> seed = List.of(
                // Premium vendor: worst name-sort position and lowest view count, so only the
                // placement band can put it first in either sort.
                vendor(premiumName, "$", 1, city),
                vendor(cancelledName, "$", 500, city),
                vendor(popularName, "$", 2_000_000_000, city));
        List<VendorEntity> saved = jpaRepository.saveAll(seed);

        try {
            UUID premiumId = saved.stream().filter(v -> premiumName.equals(v.getBusinessName()))
                    .findFirst().orElseThrow().getId();
            UUID cancelledId = saved.stream().filter(v -> cancelledName.equals(v.getBusinessName()))
                    .findFirst().orElseThrow().getId();
            jdbcTemplate.update(
                    "INSERT INTO vendor_subscriptions (vendor_id, plan_tier, status) VALUES (?, 'PREMIUM', 'ACTIVE')",
                    premiumId);
            jdbcTemplate.update(
                    "INSERT INTO vendor_subscriptions (vendor_id, plan_tier, status) VALUES (?, 'PREMIUM', 'CANCELLED')",
                    cancelledId);

            // Default (popularity) sort: premium first despite having 1 view, then the remaining
            // band ordered by views, so the cancelled-premium vendor gets no placement boost.
            VendorPageResult byViews = vendorService.getVendors(null, city, null, null, 0, 20);
            assertThat(byViews.vendors())
                    .as("active PREMIUM pins first; the rest fall back to most-viewed order")
                    .extracting(Vendor::businessName)
                    .containsExactly(premiumName, popularName, cancelledName);

            // Alphabetical sort: premium still first even though its name sorts last.
            VendorPageResult byName = vendorService.getVendors(null, city, null, "name", 0, 20);
            assertThat(byName.vendors())
                    .as("active PREMIUM pins first; the rest fall back to A-Z order")
                    .extracting(Vendor::businessName)
                    .containsExactly(premiumName, cancelledName, popularName);
        } finally {
            // vendor_subscriptions rows cascade with the vendor delete (fk ON DELETE CASCADE).
            jdbcTemplate.update("DELETE FROM vendors WHERE email LIKE ?", "%" + MARKER_DOMAIN);
        }
    }

    @Test
    void directoryDefaultSortIndexExistsAfterMigration() {
        // Only the V79 migration creates an index with this name; a missing index returns 0.
        Integer matches = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM sys.indexes WHERE name = 'ix_vendors_directory_default'",
                Integer.class);

        assertThat(matches)
                .as("V79 must create ix_vendors_directory_default")
                .isEqualTo(1);
    }

    private VendorEntity vendor(String businessName, String priceTier, int viewCount) {
        return vendor(businessName, priceTier, viewCount, "Austin");
    }

    private VendorEntity vendor(String businessName, String priceTier, int viewCount, String city) {
        return VendorEntity.builder()
                .businessName(businessName)
                .category(VendorCategory.PHOTOGRAPHER)
                .city(city)
                .state("TX")
                .email(businessName + MARKER_DOMAIN)
                .passwordHash("hash")
                .isChristianOwned(true)
                .isActive(true)
                .isVerified(true)
                .priceTier(priceTier)
                .viewCount(viewCount)
                .build();
    }
}
