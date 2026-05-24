package com.altarwed.web.mapper;

import com.altarwed.application.dto.PrintOrderResponse;
import com.altarwed.domain.model.PrintOrder;

public final class PrintOrderMapper {
    private PrintOrderMapper() {}

    public static PrintOrderResponse toResponse(PrintOrder o) {
        return new PrintOrderResponse(
                o.id(),
                o.coupleId(),
                o.orderType().name(),
                o.status().name(),
                o.templateKey(),
                o.recipientCount(),
                o.costCents(),
                o.errorMessage(),
                o.createdAt(),
                o.submittedAt(),
                o.recipients() == null ? java.util.List.of() :
                        o.recipients().stream().map(r -> new PrintOrderResponse.Recipient(
                                r.guestId(), r.lobPostcardId(), r.deliveryStatus(), r.errorMessage()
                        )).toList()
        );
    }
}
