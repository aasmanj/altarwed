package com.altarwed.application.service;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.altarwed.application.dto.CreateBudgetItemRequest;
import com.altarwed.application.dto.UpdateBudgetItemRequest;
import com.altarwed.domain.model.BudgetCategory;
import com.altarwed.domain.model.BudgetItem;
import com.altarwed.domain.model.Couple;
import com.altarwed.domain.port.BudgetItemRepository;
import com.altarwed.domain.port.CoupleRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.slf4j.LoggerFactory;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Verifies the write-event logging added for issue #30. Each assertion fails against the
 * pre-change service (which emitted zero log lines) and passes after, so this is the
 * CI-runnable proof that the observability gap is closed. The lines must carry the internal
 * scope id (coupleId) and the entity id and nothing else, so the test also pins that the
 * structured args are present without asserting on any PII field. Mockito only, no Spring
 * context, per the backend testing rules.
 */
@ExtendWith(MockitoExtension.class)
class BudgetItemServiceLoggingTest {

    @Mock private BudgetItemRepository budgetItemRepository;
    @Mock private CoupleRepository coupleRepository;

    // The service logs through LoggerFactory.getLogger(BudgetItemService.class); attaching a
    // Logback ListAppender to that same named logger captures the events in-memory so we can
    // assert level and rendered message without a real appender or Spring context.
    private final Logger serviceLogger = (Logger) LoggerFactory.getLogger(BudgetItemService.class);
    private ListAppender<ILoggingEvent> appender;

    @BeforeEach
    void attachAppender() {
        appender = new ListAppender<>();
        appender.start();
        serviceLogger.addAppender(appender);
    }

    @AfterEach
    void detachAppender() {
        serviceLogger.detachAppender(appender);
    }

    private BudgetItemService service() {
        return new BudgetItemService(budgetItemRepository, coupleRepository);
    }

    @Test
    void createItem_emitsInfoWithCoupleIdAndItemId() {
        UUID coupleId = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();
        when(coupleRepository.findById(coupleId)).thenReturn(Optional.of(couple(coupleId)));
        when(budgetItemRepository.save(any())).thenAnswer(inv -> withId(inv.getArgument(0), itemId));

        service().createItem(coupleId, new CreateBudgetItemRequest(
                BudgetCategory.VENUE, "Acme Hall", new BigDecimal("1000.00"), null, false, null));

        assertThat(appender.list).anyMatch(e -> e.getLevel() == Level.INFO
                && e.getFormattedMessage().contains("budget item created")
                && e.getFormattedMessage().contains(coupleId.toString())
                && e.getFormattedMessage().contains(itemId.toString()));
    }

    @Test
    void updateItem_emitsInfoWithCoupleIdAndItemId() {
        UUID coupleId = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();
        BudgetItem existing = new BudgetItem(itemId, coupleId, BudgetCategory.VENUE, "Acme Hall",
                new BigDecimal("1000.00"), null, false, null, null, null);
        when(budgetItemRepository.findById(itemId)).thenReturn(Optional.of(existing));
        when(budgetItemRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service().updateItem(coupleId, itemId, new UpdateBudgetItemRequest(
                null, "Renamed Hall", null, null, true, null));

        assertThat(appender.list).anyMatch(e -> e.getLevel() == Level.INFO
                && e.getFormattedMessage().contains("budget item updated")
                && e.getFormattedMessage().contains(coupleId.toString())
                && e.getFormattedMessage().contains(itemId.toString()));
    }

    @Test
    void deleteItem_emitsInfoWithCoupleIdAndItemId() {
        UUID coupleId = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();
        when(budgetItemRepository.existsByIdAndCoupleId(itemId, coupleId)).thenReturn(true);

        service().deleteItem(coupleId, itemId);

        assertThat(appender.list).anyMatch(e -> e.getLevel() == Level.INFO
                && e.getFormattedMessage().contains("budget item deleted")
                && e.getFormattedMessage().contains(coupleId.toString())
                && e.getFormattedMessage().contains(itemId.toString()));
    }

    private static Couple couple(UUID coupleId) {
        return new Couple(coupleId, "Partner", "Partner", "couple@example.com", "hash",
                null, null, null, false, true, null, null);
    }

    private static BudgetItem withId(BudgetItem in, UUID id) {
        return new BudgetItem(id, in.coupleId(), in.category(), in.vendorName(),
                in.estimatedCost(), in.actualCost(), in.isPaid(), in.notes(),
                in.createdAt(), in.updatedAt());
    }
}
