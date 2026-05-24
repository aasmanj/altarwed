package com.altarwed.application.service;

import com.altarwed.application.dto.CreatePrintOrderRequest;
import com.altarwed.domain.model.*;
import com.altarwed.domain.port.*;
import com.altarwed.domain.port.PrintMailPort.FromAddress;
import com.altarwed.domain.port.PrintMailPort.PostcardRequest;
import com.altarwed.domain.port.PrintMailPort.ToAddress;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class PrintOrderService {

    private static final Logger log = LoggerFactory.getLogger(PrintOrderService.class);

    // Rough per-postcard cost preview (USPS first-class 6x11 via Lob ~ $1.50).
    // This is informational only — Lob bills us out of band.
    private static final int COST_PER_POSTCARD_CENTS = 150;

    // Greedy first group captures "line1[, line2]"; then city, state (2 letters), zip (5 or 9).
    private static final Pattern ADDRESS_PATTERN = Pattern.compile(
            "^(.+),\\s*([^,]+),\\s*([A-Za-z]{2})\\s+(\\d{5}(?:-\\d{4})?)$"
    );

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
     * loop guarantees an audit row exists if anything explodes mid-flight — including
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

        Couple couple = coupleRepository.findById(coupleId)
                .orElseThrow(() -> new IllegalArgumentException("Couple not found"));
        Optional<WeddingWebsite> websiteOpt = websiteRepository.findByCoupleId(coupleId);

        String coupleNames = couple.partnerOneName() + " & " + couple.partnerTwoName();
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
        // row even if Lob calls or the final save fail.
        PrintOrder draft = printOrderRepository.save(new PrintOrder(
                null, coupleId, orderType, PrintOrderStatus.DRAFT, req.templateKey(),
                req.guestIds().size(), 0, null, LocalDateTime.now(), null, List.of()
        ));
        UUID orderId = draft.id();

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

            ParsedAddress parsed = parseAddress(guest.mailAddress());
            if (parsed == null) {
                recipients.add(new PrintOrderRecipient(null, null, guestId, null, "FAILED",
                        "Could not parse mailing address. Expected format: \"123 Main St, City, ST 12345\""));
                failureCount++;
                continue;
            }

            ToAddress to = new ToAddress(
                    guest.name(), parsed.line1, parsed.line2,
                    parsed.city, parsed.state, parsed.zip
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
                log.warn("Print mail rejected for guest {}: {}", guestId, ex.getMessage());
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
                recipients
        );
        return printOrderRepository.save(order);
    }

    // -------------------------------------------------------------------------
    // Address parsing — best-effort regex. Skip guests whose address won't parse;
    // they get a FAILED recipient and the couple sees a clear error in the UI.
    // -------------------------------------------------------------------------

    private record ParsedAddress(String line1, String line2, String city, String state, String zip) {}

    static ParsedAddress parseAddress(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String normalized = raw.replace("\n", ", ").replace("\r", " ").trim().replaceAll("\\s{2,}", " ");
        // Collapse repeated commas that newline normalization can introduce.
        normalized = normalized.replaceAll(",\\s*,", ",");
        Matcher m = ADDRESS_PATTERN.matcher(normalized);
        if (!m.matches()) return null;

        String linePart = m.group(1).trim();
        String city = m.group(2).trim();
        String state = m.group(3).trim().toUpperCase();
        String zip = m.group(4).trim();

        // If the line part contains an extra comma, treat everything before the last
        // comma as line1 and the remainder as line2.
        String line1 = linePart;
        String line2 = null;
        int lastComma = linePart.lastIndexOf(',');
        if (lastComma >= 0) {
            line1 = linePart.substring(0, lastComma).trim();
            line2 = linePart.substring(lastComma + 1).trim();
            if (line2.isBlank()) line2 = null;
        }
        return new ParsedAddress(line1, line2, city, state, zip);
    }
}
