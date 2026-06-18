package com.altarwed.domain.port;

import com.altarwed.domain.model.EmailDelivery;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface EmailDeliveryRepository {

    // Looked up by the webhook to decide whether a row already exists for this
    // Resend email (insert vs update).
    Optional<EmailDelivery> findByResendEmailId(String resendEmailId);

    EmailDelivery save(EmailDelivery delivery);

    // Read path for the dashboard: every delivery row for a couple's guests, which
    // the service reduces to the latest status per (guest, email type).
    List<EmailDelivery> findByCoupleId(UUID coupleId);
}
