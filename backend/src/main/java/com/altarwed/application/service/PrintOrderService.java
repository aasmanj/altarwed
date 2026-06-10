package com.altarwed.application.service;

import com.altarwed.application.dto.CreatePrintOrderRequest;
import com.altarwed.domain.model.*;
import com.altarwed.domain.port.*;
import com.altarwed.domain.port.PrintMailPort.FromAddress;
import com.altarwed.domain.port.PrintMailPort.PostcardRequest;
import com.altarwed.domain.port.PrintMailPort.ToAddress;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class PrintOrderService {

    private static final Logger log = LoggerFactory.getLogger(PrintOrderService.class);

    // Rough per-postcard cost preview (USPS first-class 6x11 via Lob ~ $1.50).
    // This is informational only, Lob bills us out of band.
    private static final int COST_PER_POSTCARD_CENTS = 150;

    private final PrintOrderRepository printOrderRepository;
    private final PrintMailPort printMailPort;
    private final GuestRepository guestRepository;
    private final WeddingWebsiteRepository websiteRepository;
    private final CoupleRepository coupleRepository;

    public PrintOrderService(
            PrintOrderRepository printOrderRepository,
            PrintMailPort printMailPort,
            GuestRepository guestRepository,
            WeddingWebsiteRepository websiteRepository,
            CoupleRepository coupleRepository
    ) {
        this.printOrderRepository = printOrderRepository;
        this.printMailPort = printMailPort;
        this.guestRepository = guestRepository;
        this.websiteRepository = websiteRepository;
        this.coupleRepository = coupleRepository;
    }

    @Transactional(readOnly = true)
    public List<PrintOrder> listOrders(UUID coupleId) {
        return printOrderRepository.findAllByCoupleId(coupleId);
    }

    /**
     * Deliberately NOT @Transactional. Persisting a DRAFT order row BEFORE the Lob
     * loop guarantees an audit row exists if anything explodes mid-flight, including
     * a power loss between Lob acceptance and the final save. Wrapping the whole
     * method in a transaction would roll back the DRAFT row on failure even though
     * Lob has already accepted (and will charge for + mail) the postcards we sent so
     * far, leaving us with phantom mail and no DB trail.
     *
     * Each printOrderRepository.save() is internally @Transactional via Spring Data,
     * so the DRAFT-insert and the final UPDATE each run in their own short transaction.
     */
    public PrintOrder createOrder(UUID coupleId, CreatePrintOrderRequest req) {
        PrintOrderType orderType = PrintOrderType.valueOf(req.orderType());
        String idempotencyKey = req.idempotencyKey();
        log.info("print order requested, coupleId={}, orderType={}, templateKey={}, recipients={}",
                 coupleId, orderType, req.templateKey(), req.guestIds().size());

        // Idempotency guard: a double-click or an exact-batch retry carries the same
        // client-generated key. If we already have an order for it, return that one
        // instead of mailing and billing the whole batch a second time.
        //
        // Edge case: if the matched order is still in DRAFT (a prior attempt died
        // between the draft insert and the Lob loop, e.g. a dropped connection), we
        // still return it. That is deliberate, returning the draft is strictly safer
        // than re-running the Lob loop and risking a double charge. The draft self-
        // heals: the original (or this) request finalizes it to SUBMITTED, and the
        // client's Past Orders list reflects the real state on its next refetch.
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            Optional<PrintOrder> replay = printOrderRepository.findByCoupleIdAndIdempotencyKey(coupleId, idempotencyKey);
            if (replay.isPresent()) {
                log.info("print order idempotent replay, returning existing, coupleId={}, orderId={}, status={}",
                         coupleId, replay.get().id(), replay.get().status());
                return replay.get();
            }
        }

        Couple couple = coupleRepository.findById(coupleId)
                .orElseThrow(() -> new IllegalArgumentException("Couple not found"));
        Optional<WeddingWebsite> websiteOpt = websiteRepository.findByCoupleId(coupleId);

        // Display convention: bride (partnerTwoName) first per Jordan's preference.
        // Postcards print "Bride & Groom" rather than "Groom & Bride".
        String coupleNames = couple.partnerTwoName() + " & " + couple.partnerOneName();
        String weddingDate = websiteOpt.map(WeddingWebsite::weddingDate)
                .map(d -> d.format(DateTimeFormatter.ofPattern("MMMM d, yyyy")))
                .orElse("TBD");
        String weddingUrl = websiteOpt.map(w -> "https://www.altarwed.com/wedding/" + w.slug())
                .orElse("https://www.altarwed.com");
        String heroPhotoUrl = websiteOpt.map(WeddingWebsite::heroPhotoUrl).orElse(null);
        String venueLine = websiteOpt.map(w -> {
            String name = w.venueName();
            String city = w.venueCity();
            String state = w.venueState();
            if (name == null || name.isBlank()) return null;
            StringBuilder sb = new StringBuilder(name);
            if (city != null && !city.isBlank()) sb.append(" · ").append(city);
            if (state != null && !state.isBlank()) sb.append(", ").append(state);
            return sb.toString();
        }).orElse(null);

        FromAddress from = new FromAddress(
                req.returnName(), req.returnAddressLine1(), req.returnAddressLine2(),
                req.returnCity(), req.returnState().toUpperCase(), req.returnZip()
        );

        // Step 1: persist DRAFT before any external side-effect so we have an audit
        // row even if Lob calls or the final save fail. The DRAFT also claims the
        // idempotency key in the unique index, so a racing concurrent submit with
        // the same key fails here rather than mailing a duplicate batch.
        PrintOrder draft;
        try {
            draft = printOrderRepository.save(new PrintOrder(
                    null, coupleId, orderType, PrintOrderStatus.DRAFT, req.templateKey(),
                    req.guestIds().size(), 0, null, LocalDateTime.now(), null, List.of(), idempotencyKey
            ));
        } catch (DataIntegrityViolationException race) {
            // Concurrent request with the same key won the unique index. Hand back
            // its order rather than mailing again.
            log.warn("print order idempotency race, returning concurrent order, coupleId={}", coupleId);
            if (idempotencyKey != null && !idempotencyKey.isBlank()) {
                return printOrderRepository.findByCoupleIdAndIdempotencyKey(coupleId, idempotencyKey)
                        .orElseThrow(() -> race);
            }
            throw race;
        }
        UUID orderId = draft.id();
        log.info("print order draft persisted, orderId={}, coupleId={}", orderId, coupleId);

        List<PrintOrderRecipient> recipients = new ArrayList<>();
        int successCount = 0;
        int failureCount = 0;

        for (UUID guestId : req.guestIds()) {
            Guest guest = guestRepository.findById(guestId).orElse(null);
            if (guest == null || !coupleId.equals(guest.coupleId())) {
                recipients.add(new PrintOrderRecipient(null, null, guestId, null, "FAILED",
                        "Guest not found or does not belong to this couple"));
                failureCount++;
                continue;
            }

            boolean isDomestic = guest.mailCountry() == null || guest.mailCountry().isBlank();
            boolean missingAddress = guest.mailLine1() == null || guest.mailCity() == null
                    || (isDomestic && (guest.mailState() == null || guest.mailZip() == null));
            if (missingAddress) {
                String hint = isDomestic
                        ? "Guest is missing a mailing address. Fill in address line, city, state, and ZIP on the guest list."
                        : "Guest is missing a mailing address. Fill in address line and city (state and postal code optional for international).";
                recipients.add(new PrintOrderRecipient(null, null, guestId, null, "FAILED", hint));
                failureCount++;
                continue;
            }

            ToAddress to = new ToAddress(
                    guest.name(), guest.mailLine1(), null,
                    guest.mailCity(), guest.mailState(), guest.mailZip(), guest.mailCountry()
            );

            PostcardRequest postcard = new PostcardRequest(
                    req.templateKey(), coupleNames, weddingDate, weddingUrl,
                    heroPhotoUrl, venueLine, from, to
            );

            try {
                String lobId = printMailPort.sendPostcard(postcard);
                recipients.add(new PrintOrderRecipient(null, null, guestId, lobId, "SUBMITTED", null));
                successCount++;
            } catch (PrintMailPort.PrintMailException ex) {
                // Pass the exception as the last arg per CLAUDE.md rule 10 (stack
                // trace preserves the Lob response body wrapped by the adapter).
                log.warn("lob rejected postcard, orderId={}, guestId={}", orderId, guestId, ex);
                recipients.add(new PrintOrderRecipient(null, null, guestId, null, "FAILED", ex.getMessage()));
                failureCount++;
            }
        }

        PrintOrderStatus status;
        String errorMessage = null;
        if (successCount == 0) {
            status = PrintOrderStatus.FAILED;
            errorMessage = "All " + failureCount + " postcards failed to submit. See per-recipient errors.";
        } else if (failureCount > 0) {
            status = PrintOrderStatus.PARTIAL_FAILURE;
            errorMessage = failureCount + " of " + recipients.size() + " postcards failed. See per-recipient errors.";
        } else {
            status = PrintOrderStatus.SUBMITTED;
        }

        LocalDateTime now = LocalDateTime.now();
        PrintOrder order = new PrintOrder(
                orderId, coupleId, orderType, status, req.templateKey(),
                recipients.size(), successCount * COST_PER_POSTCARD_CENTS,
                errorMessage, draft.createdAt(),
                successCount > 0 ? now : null,
                recipients,
                idempotencyKey
        );
        PrintOrder saved = printOrderRepository.save(order);
        log.info("print order finalized, orderId={}, coupleId={}, status={}, succeeded={}, failed={}",
                 orderId, coupleId, status, successCount, failureCount);
        return saved;
    }

}
