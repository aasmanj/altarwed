package com.altarwed.infrastructure.persistence;

import com.altarwed.domain.model.MetricsSnapshot;
import com.altarwed.domain.model.WebsiteAdminRow;
import com.altarwed.domain.model.WebsiteRoster;
import com.altarwed.domain.port.MetricsRepository;
import com.altarwed.infrastructure.persistence.entity.CoupleEntity;
import com.altarwed.infrastructure.persistence.entity.WeddingWebsiteEntity;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Repository
public class MetricsJpaAdapter implements MetricsRepository {

    @PersistenceContext
    private EntityManager em;

    @Override
    public MetricsSnapshot snapshot() {
        LocalDateTime now = LocalDateTime.now();
        long couples = scalarLong("SELECT COUNT(c) FROM CoupleEntity c");
        long couples7 = scalarLong(
                "SELECT COUNT(c) FROM CoupleEntity c WHERE c.createdAt >= :since",
                Map.of("since", now.minusDays(7)));
        long couples30 = scalarLong(
                "SELECT COUNT(c) FROM CoupleEntity c WHERE c.createdAt >= :since",
                Map.of("since", now.minusDays(30)));

        long websites = scalarLong("SELECT COUNT(w) FROM WeddingWebsiteEntity w WHERE w.isDeleted = false");
        long published = scalarLong(
                "SELECT COUNT(w) FROM WeddingWebsiteEntity w WHERE w.isPublished = true AND w.isDeleted = false");

        long guests = scalarLong("SELECT COUNT(g) FROM GuestEntity g");
        long attending = scalarLong("SELECT COUNT(g) FROM GuestEntity g WHERE g.rsvpStatus = 'ATTENDING'");
        long declining = scalarLong("SELECT COUNT(g) FROM GuestEntity g WHERE g.rsvpStatus = 'DECLINING'");

        long vendors = scalarLong("SELECT COUNT(v) FROM VendorEntity v");
        long activeVendors = scalarLong("SELECT COUNT(v) FROM VendorEntity v WHERE v.isActive = true");
        long verifiedVendors = scalarLong("SELECT COUNT(v) FROM VendorEntity v WHERE v.isVerified = true");

        long blogPosts = scalarLong("SELECT COUNT(b) FROM BlogPostEntity b");
        long budgetItems = scalarLong("SELECT COUNT(b) FROM BudgetItemEntity b");
        long ceremonySections = scalarLong("SELECT COUNT(c) FROM CeremonySectionEntity c");
        long planningTasks = scalarLong("SELECT COUNT(p) FROM PlanningTaskEntity p");
        long photos = scalarLong("SELECT COUNT(p) FROM WeddingPhotoEntity p");

        return new MetricsSnapshot(
                couples, couples7, couples30,
                websites, published,
                guests, attending, declining,
                vendors, activeVendors, verifiedVendors,
                blogPosts, budgetItems, ceremonySections, planningTasks, photos,
                signupsByDay(30),
                topAcquisitionSources(8));
    }

    // Couples grouped by their utm_source, busiest channel first. A null/blank
    // utm_source (organic, direct, or pre-V46 signups) collapses into "direct" so
    // the founder sees one honest bucket instead of a missing slice. Capped to
    // `limit` rows; the breakdown is a glance, not an export.
    private List<MetricsSnapshot.SourceCount> topAcquisitionSources(int limit) {
        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createQuery(
                        "SELECT c.utmSource, COUNT(c) FROM CoupleEntity c "
                                + "GROUP BY c.utmSource ORDER BY COUNT(c) DESC")
                .setMaxResults(limit)
                .getResultList();

        List<MetricsSnapshot.SourceCount> out = new ArrayList<>();
        for (Object[] row : rows) {
            String source = (String) row[0];
            if (source == null || source.isBlank()) source = "direct";
            out.add(new MetricsSnapshot.SourceCount(source, ((Number) row[1]).longValue()));
        }
        return out;
    }

    private List<MetricsSnapshot.DailyCount> signupsByDay(int days) {
        LocalDateTime since = LocalDate.now().minusDays(days - 1L).atStartOfDay();
        @SuppressWarnings("unchecked")
        List<LocalDateTime> timestamps = em.createQuery(
                "SELECT c.createdAt FROM CoupleEntity c WHERE c.createdAt >= :since")
                .setParameter("since", since)
                .getResultList();

        Map<LocalDate, Long> counts = new HashMap<>();
        for (LocalDateTime ts : timestamps) {
            counts.merge(ts.toLocalDate(), 1L, Long::sum);
        }
        List<MetricsSnapshot.DailyCount> out = new ArrayList<>();
        LocalDate today = LocalDate.now();
        for (int i = days - 1; i >= 0; i--) {
            LocalDate d = today.minusDays(i);
            out.add(new MetricsSnapshot.DailyCount(d, counts.getOrDefault(d, 0L)));
        }
        return out;
    }

    @Override
    public WebsiteRoster websiteRoster(int page, int size) {
        long total = scalarLong("SELECT COUNT(c) FROM CoupleEntity c");

        List<CoupleEntity> couples = em.createQuery(
                        "SELECT c FROM CoupleEntity c ORDER BY c.createdAt DESC", CoupleEntity.class)
                .setFirstResult(page * size)
                .setMaxResults(size)
                .getResultList();

        if (couples.isEmpty()) {
            return new WebsiteRoster(List.of(), total, page, size);
        }

        List<UUID> coupleIds = couples.stream().map(CoupleEntity::getId).toList();
        List<WeddingWebsiteEntity> websites = em.createQuery(
                        "SELECT w FROM WeddingWebsiteEntity w WHERE w.coupleId IN :ids AND w.isDeleted = false",
                        WeddingWebsiteEntity.class)
                .setParameter("ids", coupleIds)
                .getResultList();

        Map<UUID, WeddingWebsiteEntity> byCoupleId = new HashMap<>();
        for (WeddingWebsiteEntity w : websites) {
            byCoupleId.put(w.getCoupleId(), w);
        }

        List<WebsiteAdminRow> rows = couples.stream().map(c -> {
            WeddingWebsiteEntity w = byCoupleId.get(c.getId());
            return new WebsiteAdminRow(
                    c.getId(),
                    c.getEmail(),
                    c.getPartnerOneName(),
                    c.getPartnerTwoName(),
                    c.getWeddingDate(),
                    c.getCreatedAt(),
                    w != null ? w.getSlug() : null,
                    w != null ? w.isPublished() : null
            );
        }).toList();

        return new WebsiteRoster(rows, total, page, size);
    }

    private long scalarLong(String jpql) {
        return ((Number) em.createQuery(jpql).getSingleResult()).longValue();
    }

    private long scalarLong(String jpql, Map<String, Object> params) {
        var q = em.createQuery(jpql);
        params.forEach(q::setParameter);
        return ((Number) q.getSingleResult()).longValue();
    }
}
