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

    // One page of the public directory (GET /api/v1/vendors). The category/city/priceTier
    // filters, the sort, AND the page slice are ALL applied in the database, never on a
    // pre-truncated in-memory candidate set (issue #135). Before this, the adapter kept only the
    // alphabetically-first MAX_SEARCH_RESULTS rows, then the service sorted and the adapter
    // tier-filtered that prefix in memory, so past 100 matches a popular vendor whose name sorts
    // after position 100 never surfaced in the default sort, and a tier filter's total was
    // bounded by that 100-row prefix rather than the real match count. A null or blank
    // category/city/priceTier means "no filter on that field" (keeps the tier filter server-side,
    // never in the browser). sort is "name" for alphabetical A-Z; anything else (or null) is the
    // default most-viewed order. Ordering is deterministic, tie-broken on the id primary key. The
    // service caps the returned window and the reported total at MAX_SEARCH_RESULTS.
    List<Vendor> findDirectoryPage(VendorCategory category, String city, String priceTier,
                                   String sort, int page, int size);

    // Total active+verified vendors matching the same category/city/priceTier filters, computed
    // as a COUNT in the database (no rows streamed). Feeds the "Showing N of M" label and
    // prev/next controls. The service caps it at MAX_SEARCH_RESULTS so the public directory never
    // advertises, or lets an unauthenticated caller page past, the first 100 matches
    // (egress / DoS bound).
    long countDirectory(VendorCategory category, String city, String priceTier);

    void deleteById(UUID id);

    void incrementViewCount(UUID id);

    long countVerified();

    // Atomic founding-25 slot allocation (issue #554). Returns true and consumes one slot only if
    // fewer than {@code cap} founding slots have been claimed, serialized at the database so a
    // concurrent registration burst can never push founding grants past the cap. This REPLACES the
    // old check-then-act (countVerified() < cap, then grant): the check and the reservation are now
    // one atomic conditional UPDATE, so there is no stale window between them. Must be called inside
    // the registering transaction so the reservation commits or rolls back with the vendor row.
    boolean tryClaimFoundingSlot(long cap);

    // Committed founding-slot claims. The public founding-spots surface must read the SAME counter
    // the grant gate consumes: countVerified() also counts paid/comped verifications, so it drifts
    // above slots_claimed and would under-report remaining spots on /for-vendors.
    long countFoundingSlotsClaimed();
}
