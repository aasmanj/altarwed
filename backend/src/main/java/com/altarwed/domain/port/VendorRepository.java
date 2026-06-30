package com.altarwed.domain.port;

import com.altarwed.domain.model.Vendor;
import com.altarwed.domain.model.VendorCategory;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface VendorRepository {

    // Hard server-side cap on public, unauthenticated directory results. A blank-filter
    // request must never stream the whole active-vendor table (egress / DoS vector), so
    // the adapter pages each query to this many rows and the service trims defensively.
    int MAX_SEARCH_RESULTS = 100;

    Vendor save(Vendor vendor);

    Optional<Vendor> findById(UUID id);

    Optional<Vendor> findByEmail(String email);

    boolean existsByEmail(String email);

    List<Vendor> findByCity(String city);

    List<Vendor> findByCityAndCategory(String city, VendorCategory category);

    List<Vendor> findByCategory(VendorCategory category);

    List<Vendor> findAllActive();

    // Public directory query with an optional server-side price-tier filter, used by the
    // paginated GET /api/v1/vendors. Returns the active+verified candidate set matching the
    // given category/city/priceTier, already capped at MAX_SEARCH_RESULTS in a deterministic
    // order. Sorting, the page slice, and the total count are applied by the service on top of
    // this capped set (cheap at current scale). A null or blank argument means "no filter on
    // that field"; this keeps the tier filter on the backend instead of in the browser.
    List<Vendor> findByFilters(VendorCategory category, String city, String priceTier);

    void deleteById(UUID id);

    void incrementViewCount(UUID id);

    long countVerified();
}
