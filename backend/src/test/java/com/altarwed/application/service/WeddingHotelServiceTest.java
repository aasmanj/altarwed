package com.altarwed.application.service;

import com.altarwed.application.dto.WeddingHotelRequest;
import com.altarwed.domain.model.WeddingHotel;
import com.altarwed.domain.port.WeddingHotelRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WeddingHotelServiceTest {

    @Mock private WeddingHotelRepository hotelRepository;

    private WeddingHotelService service() {
        return new WeddingHotelService(hotelRepository);
    }

    private WeddingHotel hotel(UUID websiteId, int sortOrder) {
        return new WeddingHotel(
                UUID.randomUUID(), websiteId, "Hotel", "1 Main St",
                "https://book.example", "$199/night", "2.3 miles",
                sortOrder, LocalDateTime.now(), LocalDateTime.now()
        );
    }

    private WeddingHotelRequest request() {
        return new WeddingHotelRequest("The Grand", "5 Park Ave", "https://grand.example", "$149/night", null, null);
    }

    @Test
    void addHotel_derivesSortOrderFromMaxPlusOne_afterMiddleDelete() {
        UUID websiteId = UUID.randomUUID();
        // Seed 3 hotels (orders 0, 1, 2) then the middle (order 1) is deleted,
        // leaving a list whose size (2) no longer matches max(sortOrder) (2).
        when(hotelRepository.findAllByWebsiteId(websiteId))
                .thenReturn(List.of(hotel(websiteId, 0), hotel(websiteId, 2)));
        when(hotelRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service().addHotel(websiteId, request());

        ArgumentCaptor<WeddingHotel> saved = ArgumentCaptor.forClass(WeddingHotel.class);
        verify(hotelRepository).save(saved.capture());
        // size() would have produced 2 (a collision); max()+1 produces 3.
        assertThat(saved.getValue().sortOrder()).isEqualTo(3);
        assertThat(saved.getValue().sortOrder()).isNotIn(0, 2);
    }

    @Test
    void addHotel_usesSortOrderZero_forFirstHotel() {
        UUID websiteId = UUID.randomUUID();
        when(hotelRepository.findAllByWebsiteId(websiteId)).thenReturn(List.of());
        when(hotelRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service().addHotel(websiteId, request());

        ArgumentCaptor<WeddingHotel> saved = ArgumentCaptor.forClass(WeddingHotel.class);
        verify(hotelRepository).save(saved.capture());
        assertThat(saved.getValue().sortOrder()).isZero();
    }

    @Test
    void addHotel_honorsExplicitSortOrderOverride() {
        UUID websiteId = UUID.randomUUID();
        when(hotelRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        WeddingHotelRequest req = new WeddingHotelRequest(
                "Override Inn", "9 Elm St", "https://override.example", "$99/night", null, 7);
        service().addHotel(websiteId, req);

        ArgumentCaptor<WeddingHotel> saved = ArgumentCaptor.forClass(WeddingHotel.class);
        verify(hotelRepository).save(saved.capture());
        assertThat(saved.getValue().sortOrder()).isEqualTo(7);
    }
}
