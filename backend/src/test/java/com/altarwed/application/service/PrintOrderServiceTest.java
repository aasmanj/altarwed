package com.altarwed.application.service;

import com.altarwed.domain.model.PrintOrder;
import com.altarwed.domain.model.PrintOrderRecipient;
import com.altarwed.domain.model.PrintOrderStatus;
import com.altarwed.domain.model.PrintOrderType;
import com.altarwed.domain.port.CoupleRepository;
import com.altarwed.domain.port.GuestRepository;
import com.altarwed.domain.port.PrintMailPort;
import com.altarwed.domain.port.PrintOrderRepository;
import com.altarwed.domain.port.WeddingWebsiteRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Unit tests for the Lob delivery-status refresh path. */
class PrintOrderServiceTest {

    private final PrintOrderRepository printOrderRepository = mock(PrintOrderRepository.class);
    private final PrintMailPort printMailPort = mock(PrintMailPort.class);
    private final PrintOrderService service = new PrintOrderService(
            printOrderRepository, printMailPort,
            mock(GuestRepository.class), mock(WeddingWebsiteRepository.class), mock(CoupleRepository.class));

    private final UUID coupleId = UUID.randomUUID();
    private final UUID orderId = UUID.randomUUID();

    private PrintOrder orderWith(List<PrintOrderRecipient> recipients) {
        LocalDateTime now = LocalDateTime.now();
        return new PrintOrder(orderId, coupleId, PrintOrderType.SAVE_THE_DATE, PrintOrderStatus.SUBMITTED,
                "SAVE_THE_DATE_CLASSIC", recipients.size(), recipients.size() * 150, null, now, now,
                recipients, "idem-1");
    }

    private PrintOrderRecipient recipient(String lobId, String status) {
        return new PrintOrderRecipient(UUID.randomUUID(), orderId, UUID.randomUUID(), lobId, status, null);
    }

    @Test
    void refresh_updates_status_from_lob_and_saves() {
        var r = recipient("psc_1", "SUBMITTED");
        when(printOrderRepository.findById(orderId)).thenReturn(Optional.of(orderWith(List.of(r))));
        when(printMailPort.fetchPostcardStatus("psc_1")).thenReturn(Optional.of("Delivered"));
        when(printOrderRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        PrintOrder result = service.refreshDeliveryStatuses(coupleId, orderId);

        ArgumentCaptor<PrintOrder> captor = ArgumentCaptor.forClass(PrintOrder.class);
        verify(printOrderRepository).save(captor.capture());
        assertThat(captor.getValue().recipients().get(0).deliveryStatus()).isEqualTo("Delivered");
        assertThat(result.recipients().get(0).deliveryStatus()).isEqualTo("Delivered");
    }

    @Test
    void refresh_skips_recipients_without_a_provider_id() {
        // A FAILED recipient never got a Lob id, so it must never be polled or overwritten.
        var failed = recipient(null, "FAILED");
        when(printOrderRepository.findById(orderId)).thenReturn(Optional.of(orderWith(List.of(failed))));

        PrintOrder result = service.refreshDeliveryStatuses(coupleId, orderId);

        verify(printMailPort, never()).fetchPostcardStatus(any());
        verify(printOrderRepository, never()).save(any());
        assertThat(result.recipients().get(0).deliveryStatus()).isEqualTo("FAILED");
    }

    @Test
    void refresh_does_not_write_when_status_is_unchanged() {
        // Non-terminal status that Lob reports unchanged: polled, but no write.
        var r = recipient("psc_1", "In Transit");
        when(printOrderRepository.findById(orderId)).thenReturn(Optional.of(orderWith(List.of(r))));
        when(printMailPort.fetchPostcardStatus("psc_1")).thenReturn(Optional.of("In Transit"));

        service.refreshDeliveryStatuses(coupleId, orderId);

        verify(printMailPort).fetchPostcardStatus("psc_1");
        verify(printOrderRepository, never()).save(any());
    }

    @Test
    void refresh_skips_recipients_already_in_a_terminal_state() {
        // Delivered/Returned are terminal, so re-polling them is wasted; they must not be fetched.
        var delivered = recipient("psc_1", "Delivered");
        var returned = recipient("psc_2", "Returned to Sender");
        when(printOrderRepository.findById(orderId))
                .thenReturn(Optional.of(orderWith(List.of(delivered, returned))));

        service.refreshDeliveryStatuses(coupleId, orderId);

        verify(printMailPort, never()).fetchPostcardStatus(any());
        verify(printOrderRepository, never()).save(any());
    }

    @Test
    void refresh_rejects_an_order_not_owned_by_the_couple() {
        var othersOrder = new PrintOrder(orderId, UUID.randomUUID(), PrintOrderType.SAVE_THE_DATE,
                PrintOrderStatus.SUBMITTED, "k", 0, 0, null, LocalDateTime.now(), null, List.of(), "i");
        when(printOrderRepository.findById(orderId)).thenReturn(Optional.of(othersOrder));

        assertThatThrownBy(() -> service.refreshDeliveryStatuses(coupleId, orderId))
                .isInstanceOf(IllegalArgumentException.class);
        verify(printMailPort, never()).fetchPostcardStatus(any());
    }
}
