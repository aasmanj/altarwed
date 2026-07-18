package com.altarwed.application.service;

import com.altarwed.application.dto.CreatePrintOrderRequest;
import com.altarwed.domain.model.*;
import com.altarwed.domain.port.*;
import com.altarwed.domain.port.PrintMailPort.FromAddress;
import com.altarwed.domain.port.PrintMailPort.PostcardRequest;
import com.altarwed.domain.port.PrintMailPort.ToAddress;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class PrintOrderService {

    private static final Logger log = LoggerFactory.getLogger(PrintOrderService.class);

    // Issue #59: $2.00/postcard, ~33% margin over Lob's ~$1.50 cost. Couples are charged this
    // up front via Stripe Checkout before any postcard reaches Lob (see createOrder).
    private static final int COST_PER_POSTCARD_CENTS = 200;

    // A recipient row inserted at order-creation time (before payment/Lob) whose postcard has not
    // yet been attempted by the async batch. Distinct from "FAILED" (a guest excluded up front,
    // or a Lob send that already failed) and "SUBMITTED" (Lob already accepted it).
    private static final String RECIPIENT_STATUS_PENDING = "PENDING";
    private static final String RECIPIENT_STATUS_SUBMITTED = "SUBMITTED";
    private static final String RECIPIENT_STATUS_FAILED = "FAILED";

    private final PrintOrderRepository printOrderRepository;
    private final PrintMailPort printMailPort;
    private final GuestRepository guestRepository;
    private final WeddingWebsiteRepository websiteRepository;
    private final CoupleRepository coupleRepository;
    private final StripePort stripePort;
    private final String appBaseUrl;

    public PrintOrderService(
            PrintOrderRepository printOrderRepository,
            PrintMailPort printMailPort,
            GuestRepository guestRepository,
            WeddingWebsiteRepository websiteRepository,
            CoupleRepository coupleRepository,
            StripePort stripePort,
            @Value("${altarwed.app.base-url:https://app.altarwed.com}") String appBaseUrl
    ) {
        this.printOrderRepository = printOrderRepository;
        this.printMailPort = printMailPort;
        this.guestRepository = guestRepository;
        this.websiteRepository = websiteRepository;
        this.coupleRepository = coupleRepository;
        this.stripePort = stripePort;
        this.appBaseUrl = appBaseUrl;
    }

    @Transactional(readOnly = true)
    public List<PrintOrder> listOrders(UUID coupleId) {
        return printOrderRepository.findAllByCoupleId(coupleId);
    }

    /**
     * Best-effort refresh of per-recipient delivery status by polling Lob for each submitted
     * postcard. Only recipients with a provider id are polled (FAILED/PENDING ones never got one)
     * and that are not already in a terminal state, and a recipient's status is only changed when
     * Lob reports a different one (or new tracking data appears), so an order with no changes
     * performs no write.
     *
     * Deliberately NOT @Transactional (same reasoning as createOrder above): the per-recipient Lob
     * polls are external HTTP, each up to a 30s read timeout, and must never be held inside a DB
     * transaction or they pin a pooled connection across the whole loop. findById and the final save
     * each run in their own short Spring Data transaction; recipients are eagerly fetched, so the
     * detached order is fully materialised before any polling.
     */
    public PrintOrder refreshDeliveryStatuses(UUID coupleId, UUID orderId) {
        PrintOrder order = printOrderRepository.findById(orderId).orElse(null);
        if (order == null || !order.coupleId().equals(coupleId)) {
            // The controller's assertOwns already gates by coupleId; this is defense-in-depth. A
            // present-but-not-owned order is an IDOR probe, so log it (rule 6) before the opaque 400.
            if (order != null) {
                log.warn("print order access denied, coupleId={}, orderId={}", coupleId, orderId);
            }
            throw new IllegalArgumentException("Print order not found");
        }
        log.info("print order status refresh requested, coupleId={}, orderId={}, recipients={}",
                 coupleId, orderId, order.recipients().size());

        List<PrintOrderRecipient> updatedRecipients = new ArrayList<>(order.recipients().size());
        int changed = 0;
        for (PrintOrderRecipient r : order.recipients()) {
            if (r.lobPostcardId() == null || r.lobPostcardId().isBlank() || isTerminal(r.deliveryStatus())) {
                // No provider id (excluded/failed at submit), or already delivered/returned: nothing to poll.
                updatedRecipients.add(r);
                continue;
            }
            Optional<PrintMailPort.PostcardStatusResult> latest = printMailPort.fetchPostcardStatus(r.lobPostcardId());
            if (latest.isPresent() && (!latest.get().deliveryStatus().equals(r.deliveryStatus())
                    || latest.get().trackingNumber() != null || latest.get().expectedDeliveryDate() != null)) {
                updatedRecipients.add(new PrintOrderRecipient(
                        r.id(), r.printOrderId(), r.guestId(), r.lobPostcardId(),
                        latest.get().deliveryStatus(), r.errorMessage(),
                        latest.get().trackingNumber() != null ? latest.get().trackingNumber() : r.trackingNumber(),
                        latest.get().expectedDeliveryDate() != null ? latest.get().expectedDeliveryDate() : r.expectedDeliveryDate()));
                changed++;
            } else {
                updatedRecipients.add(r);
            }
        }

        log.info("print order status refresh finished, coupleId={}, orderId={}, updated={}",
                 coupleId, orderId, changed);
        if (changed == 0) {
            return order;
        }
        PrintOrder refreshed = new PrintOrder(
                order.id(), order.coupleId(), order.orderType(), order.status(), order.templateKey(),
                order.recipientCount(), order.costCents(), order.errorMessage(),
                order.createdAt(), order.submittedAt(), updatedRecipients, order.idempotencyKey(),
                order.stripeCheckoutSessionId(), order.stripePaymentIntentId(),
                order.amountChargedCents(), order.amountRefundedCents(),
                order.returnName(), order.returnAddressLine1(), order.returnAddressLine2(),
                order.returnCity(), order.returnState(), order.returnZip(), order.cardSize());
        return printOrderRepository.save(refreshed);
    }

    // Delivered and Returned-to-Sender are terminal USPS outcomes, so re-polling them only burns
    // Lob calls. "Processed for Delivery" is intentionally NOT terminal: a postcard may still get a
    // later Delivered scan, so we keep polling it.
    private static boolean isTerminal(String deliveryStatus) {
        if (deliveryStatus == null) return false;
        String s = deliveryStatus.toLowerCase();
        return s.equals("delivered") || s.contains("returned");
    }

    // ── Issue #59: pre-payment validation + Stripe Checkout ─────────────────────────────────────

    /** A guest excluded from the order before any charge -- bad address, ownership mismatch, etc. */
    public record ExcludedGuest(UUID guestId, String guestName, String reason) {}

    /**
     * checkoutUrl is null on an idempotent replay of an already-created order (the couple's client
     * already has the original checkoutUrl from the first response). warnings are non-blocking
     * (e.g. duplicate addresses); excludedGuests were never charged or sent.
     */
    public record CreateOrderResult(
            PrintOrder order,
            String checkoutUrl,
            List<String> warnings,
            List<ExcludedGuest> excludedGuests
    ) {}

    private record ValidatedGuest(Guest guest, ToAddress toAddress, boolean domestic) {}

    /**
     * Deliberately NOT @Transactional. Persisting a PENDING_PAYMENT order row (plus its recipient
     * rows) BEFORE creating the Stripe Checkout Session guarantees an audit row exists even if
     * Stripe or the final save fails. Each printOrderRepository call is internally @Transactional
     * via Spring Data, so each step runs in its own short transaction -- the Lob batch itself now
     * runs later, asynchronously, once payment is confirmed (see submitBatchAsync).
     */
    public CreateOrderResult createOrder(UUID coupleId, CreatePrintOrderRequest req) {
        PrintOrderType orderType = PrintOrderType.valueOf(req.orderType());
        // Issue #352: templateKey is fully couple-controlled, selects a layout branch + headline,
        // and is concatenated into Lob's description metadata. Validate it against the closed
        // allowlist before doing anything else so an unknown/mismatched value is a clean 400 rather
        // than a silently-accepted order. WARN (expected domain-rule rejection, not an error), and
        // deliberately do NOT log the raw key to avoid log injection from a rogue client.
        if (!PrintTemplate.isAllowedTemplateKey(req.templateKey())) {
            log.warn("print order rejected, unknown templateKey, coupleId={}", coupleId);
            throw new IllegalArgumentException(
                    "Unknown print template. Choose one of the available card designs.");
        }
        String idempotencyKey = req.idempotencyKey();
        log.info("print order requested, coupleId={}, orderType={}, templateKey={}, recipients={}",
                 coupleId, orderType, req.templateKey(), req.guestIds().size());

        // Idempotency guard: a double-click or an exact-batch retry carries the same
        // client-generated key. If we already have an order for it, return that one
        // instead of charging and mailing the whole batch a second time.
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            Optional<PrintOrder> replay = printOrderRepository.findByCoupleIdAndIdempotencyKey(coupleId, idempotencyKey);
            if (replay.isPresent()) {
                log.info("print order idempotent replay, returning existing, coupleId={}, orderId={}, status={}",
                         coupleId, replay.get().id(), replay.get().status());
                return new CreateOrderResult(replay.get(), null, List.of(), List.of());
            }
        }

        coupleRepository.findById(coupleId)
                .orElseThrow(() -> new IllegalArgumentException("Couple not found"));

        // ── Pre-payment validation: figure out who is actually payable BEFORE any charge ────────
        List<ExcludedGuest> excluded = new ArrayList<>();
        // Preserves request order; guestId -> validated guest + resolved address.
        Map<UUID, ValidatedGuest> valid = new LinkedHashMap<>();

        for (UUID guestId : req.guestIds()) {
            Guest guest = guestRepository.findById(guestId).orElse(null);
            if (guest == null || !coupleId.equals(guest.coupleId())) {
                excluded.add(new ExcludedGuest(guestId, null, "Guest not found or does not belong to this couple"));
                continue;
            }
            boolean isDomestic = guest.mailCountry() == null || guest.mailCountry().isBlank();
            boolean missingAddress = guest.mailLine1() == null || guest.mailCity() == null
                    || (isDomestic && (guest.mailState() == null || guest.mailZip() == null));
            if (missingAddress) {
                String hint = isDomestic
                        ? "Guest is missing a mailing address. Fill in address line, city, state, and ZIP on the guest list."
                        : "Guest is missing a mailing address. Fill in address line and city (state and postal code optional for international).";
                excluded.add(new ExcludedGuest(guestId, guest.name(), hint));
                continue;
            }

            ToAddress toAddress = new ToAddress(
                    guest.name(), guest.mailLine1(), null,
                    guest.mailCity(), guest.mailState(), guest.mailZip(), guest.mailCountry()
            );

            // Issue #59: catch a structurally-bad-but-field-complete domestic address (not a real
            // USPS deliverable location) BEFORE charging, rather than relying solely on Lob's
            // reactive rejection (which would only be caught after the couple already paid).
            // International addresses have no equivalent Lob product, so they keep only the
            // field-presence check above; the frontend surfaces that they aren't independently
            // verified.
            if (isDomestic) {
                PrintMailPort.AddressVerificationResult verification = printMailPort.verifyAddress(toAddress);
                if (!verification.deliverable()) {
                    excluded.add(new ExcludedGuest(guestId, guest.name(), verification.reason()));
                    continue;
                }
            }

            valid.put(guestId, new ValidatedGuest(guest, toAddress, isDomestic));
        }

        if (valid.isEmpty()) {
            log.warn("print order has no payable recipients, coupleId={}, requested={}, excluded={}",
                     coupleId, req.guestIds().size(), excluded.size());
            throw new IllegalArgumentException(
                    "No valid recipients: every selected guest was excluded (bad address or ownership). See excludedGuests for details.");
        }

        // Issue #59 UX: warn (never block) on guests who share a mailing address -- some couples
        // legitimately want 2 cards to the same household.
        List<String> warnings = duplicateAddressWarnings(valid);

        int payableCount = valid.size();
        int amountChargedCents = payableCount * COST_PER_POSTCARD_CENTS;

        // Step 1: persist the order (empty recipients -- inserted individually right after, see
        // below) before any external side-effect, so an audit row exists even if Stripe or the
        // Lob batch never runs. Also claims the idempotency key in the unique index, so a racing
        // concurrent submit with the same key fails here rather than double-charging.
        PrintOrder draft;
        try {
            draft = printOrderRepository.save(new PrintOrder(
                    null, coupleId, orderType, PrintOrderStatus.PENDING_PAYMENT, req.templateKey(),
                    req.guestIds().size(), 0, null, LocalDateTime.now(), null, List.of(), idempotencyKey,
                    null, null, amountChargedCents, 0,
                    req.returnName(), req.returnAddressLine1(), req.returnAddressLine2(),
                    req.returnCity(), req.returnState().toUpperCase(Locale.ROOT), req.returnZip(),
                    normalizeCardSize(req.cardSize())
            ));
        } catch (DataIntegrityViolationException race) {
            log.warn("print order idempotency race, returning concurrent order, coupleId={}", coupleId);
            if (idempotencyKey != null && !idempotencyKey.isBlank()) {
                return new CreateOrderResult(
                        printOrderRepository.findByCoupleIdAndIdempotencyKey(coupleId, idempotencyKey).orElseThrow(() -> race),
                        null, List.of(), List.of());
            }
            throw race;
        }
        UUID orderId = draft.id();
        log.info("print order pending payment, orderId={}, coupleId={}, payable={}, excluded={}, amountChargedCents={}",
                 orderId, coupleId, payableCount, excluded.size(), amountChargedCents);

        // Step 2: record every guest's initial recipient row now -- excluded guests as a terminal
        // FAILED (no charge, no Lob call, ever), payable guests as PENDING (not yet attempted; the
        // async batch below transitions these once payment is confirmed). This makes Past Orders
        // show a complete, honest picture from the moment of creation, before the couple even pays.
        for (ExcludedGuest ex : excluded) {
            printOrderRepository.appendRecipient(orderId,
                    new PrintOrderRecipient(null, orderId, ex.guestId(), null, RECIPIENT_STATUS_FAILED, ex.reason(), null, null));
        }
        for (UUID guestId : valid.keySet()) {
            printOrderRepository.appendRecipient(orderId,
                    new PrintOrderRecipient(null, orderId, guestId, null, RECIPIENT_STATUS_PENDING, null, null, null));
        }

        // Step 3: create the Stripe Checkout Session for exactly the payable amount. No Lob call
        // happens until the webhook confirms this succeeds (see StripeService).
        String description = payableCount + " postcard" + (payableCount == 1 ? "" : "s") + " (" + req.templateKey() + ")";
        String successUrl = appBaseUrl + "/dashboard/communications?printOrder=success&orderId=" + orderId;
        String cancelUrl = appBaseUrl + "/dashboard/communications?printOrder=cancelled&orderId=" + orderId;
        StripePort.CheckoutSession checkoutSession;
        try {
            checkoutSession = stripePort.createOneTimeCheckoutSession(
                    orderId, coupleRepository.findById(coupleId).map(Couple::email).orElse(null),
                    amountChargedCents, description, successUrl, cancelUrl);
        } catch (StripePort.StripeCallException ex) {
            // The order row and its recipient rows stay as an audit trail (status PENDING_PAYMENT
            // with no checkout session); the couple can retry from the UI, which will hit the same
            // idempotency key and see the same stuck order rather than a silent duplicate.
            log.error("print order checkout session creation failed, orderId={}, coupleId={}", orderId, coupleId, ex);
            throw ex;
        }
        printOrderRepository.attachCheckoutSession(orderId, checkoutSession.sessionId());

        PrintOrder result = printOrderRepository.findById(orderId).orElseThrow();
        return new CreateOrderResult(result, checkoutSession.url(), warnings, excluded);
    }

    private static List<String> duplicateAddressWarnings(Map<UUID, ValidatedGuest> valid) {
        Map<String, List<String>> byAddress = new LinkedHashMap<>();
        for (ValidatedGuest v : valid.values()) {
            ToAddress a = v.toAddress();
            String key = String.join("|",
                    normalize(a.addressLine1()), normalize(a.city()), normalize(a.state()), normalize(a.zip()));
            byAddress.computeIfAbsent(key, k -> new ArrayList<>()).add(v.guest().name());
        }
        List<String> warnings = new ArrayList<>();
        for (List<String> names : byAddress.values()) {
            if (names.size() > 1) {
                warnings.add("Guests " + String.join(", ", names) + " share the same mailing address.");
            }
        }
        return warnings;
    }

    private static String normalize(String s) {
        return s == null ? "" : s.trim().toLowerCase(Locale.ROOT);
    }

    // The DB has a CHECK constraint on card_size (V89), so persist only a recognized value.
    // Anything else (null, empty, an unknown value from a stale/rogue client) collapses to the
    // proven 6x11 landscape rather than failing the whole order at insert time -- the card shape
    // is a cosmetic preference and must never be the thing that blocks a couple's mail send.
    private static final java.util.Set<String> VALID_CARD_SIZES =
            java.util.Set.of("LANDSCAPE_6X11", "PORTRAIT_6X9", "PORTRAIT_5X7");

    private static String normalizeCardSize(String cardSize) {
        if (cardSize == null) return "LANDSCAPE_6X11";
        String v = cardSize.trim().toUpperCase(Locale.ROOT);
        return VALID_CARD_SIZES.contains(v) ? v : "LANDSCAPE_6X11";
    }

    // ── Issue #53: async Lob batch, triggered by StripeService once payment is confirmed ────────

    /**
     * Runs on printOrderExecutor (see AsyncConfig), never the HTTP/webhook thread. Persists each
     * recipient's outcome as it returns (updateRecipientOutcome on the PENDING row created in
     * createOrder), so a mid-batch crash leaves a complete DB record of every postcard Lob already
     * accepted (and will bill+mail) -- unlike the pre-#53 behavior, which only persisted after the
     * whole loop finished. Triggered from StripeService (a different bean), so this being @Async
     * is not defeated by same-class self-invocation.
     */
    @Async("printOrderExecutor")
    public void submitBatchAsync(UUID orderId) {
        PrintOrder order = printOrderRepository.findById(orderId).orElse(null);
        if (order == null) {
            log.error("print order batch could not find order, orderId={}", orderId);
            return;
        }
        if (order.status() != PrintOrderStatus.PROCESSING) {
            // Defensive: only StripeService's payment-confirmed handler should trigger this, and
            // only once (a duplicate Stripe webhook delivery is guarded there). If this ever fires
            // for an order not in PROCESSING, do not risk mailing/charging twice.
            log.warn("print order batch skipped, unexpected status, orderId={}, status={}", orderId, order.status());
            return;
        }

        UUID coupleId = order.coupleId();
        UUID runId = UUID.randomUUID();
        log.info("print order batch started, runId={}, orderId={}, coupleId={}", runId, orderId, coupleId);
        try {
            runBatch(order, orderId, coupleId, runId);
        } catch (Exception ex) {
            // Observability rule 7: async tasks need a crash bracket. Without this, an unexpected
            // failure (a DB blip, a null we didn't guard) leaves the order stuck in PROCESSING
            // forever -- the couple was already charged and nothing was finalized or ever will be.
            log.error("print order batch crashed, runId={}, orderId={}, coupleId={}", runId, orderId, coupleId, ex);
            try {
                // Re-read from DB rather than trusting any local count: per-recipient outcomes are
                // persisted incrementally as runBatch progresses (see its javadoc), so whatever
                // succeeded before the crash is already durably recorded there, independent of
                // where in runBatch the exception was thrown.
                int recovered = printOrderRepository.findById(orderId)
                        .map(o -> o.recipients().stream().filter(r -> RECIPIENT_STATUS_SUBMITTED.equals(r.deliveryStatus())).count())
                        .orElse(0L)
                        .intValue();
                printOrderRepository.finalizeOrder(orderId, PrintOrderStatus.FAILED,
                        "An unexpected error interrupted this order. Contact support.",
                        LocalDateTime.now(), recovered * COST_PER_POSTCARD_CENTS);
            } catch (Exception finalizeEx) {
                log.error("print order batch crash-recovery finalize also failed, orderId={}", orderId, finalizeEx);
            }
            return;
        }
        // runBatch itself already logged a detailed finish line (status, succeeded/failed
        // counts) -- nothing further to do here on the success path.
    }

    // Split out of submitBatchAsync so the crash bracket above can wrap the whole thing in one
    // try/catch without a huge indented block.
    private void runBatch(PrintOrder order, UUID orderId, UUID coupleId, UUID runId) {
        Couple couple = coupleRepository.findById(coupleId).orElse(null);
        Optional<WeddingWebsite> websiteOpt = websiteRepository.findByCoupleId(coupleId);
        String coupleNames = couple != null
                ? couple.partnerTwoName() + " & " + couple.partnerOneName() // bride first, per convention
                : "";
        String weddingDate = websiteOpt.map(WeddingWebsite::weddingDate)
                .map(d -> d.format(DateTimeFormatter.ofPattern("MMMM d, yyyy")))
                .orElse("TBD");
        String weddingUrl = websiteOpt.map(w -> "https://www.altarwed.com/wedding/" + w.slug())
                .orElse("https://www.altarwed.com");
        String heroPhotoUrl = websiteOpt.map(WeddingWebsite::heroPhotoUrl).orElse(null);
        String venueLine = websiteOpt.map(w -> {
            String name = w.venueName();
            if (name == null || name.isBlank()) return null;
            StringBuilder sb = new StringBuilder(name);
            if (w.venueCity() != null && !w.venueCity().isBlank()) sb.append(" · ").append(w.venueCity());
            if (w.venueState() != null && !w.venueState().isBlank()) sb.append(", ").append(w.venueState());
            return sb.toString();
        }).orElse(null);
        // Print the couple's OWN chosen scripture (from their website) on the card, not a generic
        // hardcoded verse. The adapter falls back to an AltarWed default when both are blank.
        String verseText = websiteOpt.map(WeddingWebsite::scriptureText).orElse(null);
        String verseReference = websiteOpt.map(WeddingWebsite::scriptureReference).orElse(null);
        // Issue #362: reuse the couple's own website accent as the card accent on non-photo
        // templates. Read here (not persisted on the order) so the printed card always matches the
        // couple's current website accent; the adapter sanitizes it before it reaches inline CSS.
        String accentColor = websiteOpt.map(WeddingWebsite::accentColor).orElse(null);

        FromAddress from = new FromAddress(
                order.returnName(), order.returnAddressLine1(), order.returnAddressLine2(),
                order.returnCity(), order.returnState(), order.returnZip()
        );

        int successCount = 0;
        int failureCount = 0;
        // Recipients already excluded pre-payment (status FAILED, inserted in createOrder) count
        // toward the final failure tally too, they just were never attempted here.
        for (PrintOrderRecipient r : order.recipients()) {
            if (!RECIPIENT_STATUS_PENDING.equals(r.deliveryStatus())) {
                if (RECIPIENT_STATUS_FAILED.equals(r.deliveryStatus())) failureCount++;
                continue;
            }
            // Re-fetch the guest fresh: the couple may have edited the address between payment and
            // this async run, and mailing must go to the current address, not a stale snapshot.
            Guest guest = guestRepository.findById(r.guestId()).orElse(null);
            if (guest == null) {
                printOrderRepository.updateRecipientOutcome(r.id(), null, RECIPIENT_STATUS_FAILED,
                        "Guest was removed before this postcard could be sent.");
                failureCount++;
                continue;
            }
            ToAddress to = new ToAddress(
                    guest.name(), guest.mailLine1(), null,
                    guest.mailCity(), guest.mailState(), guest.mailZip(), guest.mailCountry()
            );
            PostcardRequest postcard = new PostcardRequest(
                    order.templateKey(), coupleNames, weddingDate, weddingUrl, heroPhotoUrl, venueLine, from, to,
                    order.cardSize(), verseText, verseReference, accentColor
            );
            try {
                String lobId = printMailPort.sendPostcard(postcard);
                printOrderRepository.updateRecipientOutcome(r.id(), lobId, RECIPIENT_STATUS_SUBMITTED, null);
                successCount++;
            } catch (PrintMailPort.PrintMailException ex) {
                // Same PII caution as before: log only domain IDs, never the exception
                // message/cause (can echo submitted address fields).
                log.warn("print recipient rejected, orderId={}, guestId={}", orderId, r.guestId());
                String detail = ex.userDetail() != null ? ex.userDetail() : ex.getMessage();
                if (detail != null && detail.length() > 480) detail = detail.substring(0, 480);
                printOrderRepository.updateRecipientOutcome(r.id(), null, RECIPIENT_STATUS_FAILED, detail);
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
            errorMessage = failureCount + " of " + (successCount + failureCount) + " postcards failed. See per-recipient errors.";
        } else {
            status = PrintOrderStatus.SUBMITTED;
        }
        int finalCostCents = successCount * COST_PER_POSTCARD_CENTS;
        printOrderRepository.finalizeOrder(orderId, status, errorMessage, LocalDateTime.now(), finalCostCents);

        // Issue #59: reconcile the charge to what actually sent. The couple was charged
        // amountChargedCents up front (payableCount at payment time); refund the difference for
        // any that failed post-charge (a transient Lob error -- structurally-bad addresses were
        // already excluded before the charge, so this should be the rare case, not the common one).
        // The amountRefundedCents == 0 guard is defense-in-depth against this method ever running
        // twice for the same order (the markPaymentConfirmed compare-and-swap is the primary
        // guard against a concurrent webhook redelivery double-triggering this); the idempotency
        // key below is the same protection at the Stripe API layer, so even a genuine double
        // invocation resolves to the one original refund instead of refunding twice.
        Integer amountChargedCents = order.amountChargedCents();
        Integer amountRefundedCents = order.amountRefundedCents();
        if (amountChargedCents != null && amountChargedCents > finalCostCents && order.stripePaymentIntentId() != null
                && (amountRefundedCents == null || amountRefundedCents == 0)) {
            int refundCents = amountChargedCents - finalCostCents;
            try {
                stripePort.refundPayment(order.stripePaymentIntentId(), refundCents, "print-refund-" + orderId);
                printOrderRepository.recordRefund(orderId, refundCents);
                log.info("print order refund issued, orderId={}, refundCents={}", orderId, refundCents);
            } catch (StripePort.StripeCallException ex) {
                // Do not fail the batch/finalize over a refund failure -- the mail outcome is
                // already durably recorded above. Log loudly so this can be reconciled manually;
                // it is real money owed to the couple.
                log.error("print order refund failed, orderId={}, refundCents={}", orderId, refundCents, ex);
            }
        }

        log.info("print order batch finished, runId={}, orderId={}, coupleId={}, status={}, succeeded={}, failed={}",
                 runId, orderId, coupleId, status, successCount, failureCount);
    }
}
