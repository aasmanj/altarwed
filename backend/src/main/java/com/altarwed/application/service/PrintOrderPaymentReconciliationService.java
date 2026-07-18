package com.altarwed.application.service;

import com.altarwed.domain.model.PrintOrder;
import com.altarwed.domain.port.PrintOrderRepository;
import com.altarwed.domain.port.StripePort;
import com.altarwed.domain.port.StripePort.CheckoutSessionStatus;
import net.javacrumbs.shedlock.core.LockAssert;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

// Issue #209: reconciles print orders stuck in PENDING_PAYMENT after a lost Stripe webhook.
//
// Why this job exists at all: from our perspective webhook delivery is at-most-once. Stripe
// retries checkout.session.completed with backoff for up to 3 days, but if every retry fails
// (endpoint down, deploy window, signature misconfig) the event is gone forever -- and the
// couple's card was still charged. Without reconciliation that order sits in PENDING_PAYMENT
// indefinitely: no postcards mailed, no refund, no alert. This job makes the system eventually
// consistent by treating Stripe's Checkout Session object (not our webhook history) as the
// source of truth and polling it for any order that has been stuck longer than a webhook could
// plausibly take.
//
// Safety invariants:
//  - Convergence goes through StripeService.confirmPrintOrderPayment, the EXACT method the
//    webhook handler uses. Its markPaymentConfirmed compare-and-swap means a reconciled order,
//    a late webhook, and a second reconciliation run can race freely: exactly one caller wins
//    the PENDING_PAYMENT -> PROCESSING transition and triggers the Lob batch. Running this job
//    twice can never double-mail or double-charge.
//  - The Stripe call is read-only (retrieveCheckoutSessionStatus). This job never creates
//    sessions, captures payments, or refunds.
//  - An unpaid order with a session Stripe reports as still open is left alone: the couple may
//    still be sitting on the hosted Checkout page. Only an expired-and-unpaid session (or an
//    open one past the abandonment horizon, which Stripe's 24h max session lifetime makes
//    effectively impossible) is marked FAILED -- the same terminal status, message, and code
//    path (failPrintOrderPayment) the checkout.session.expired webhook uses, so no new enum
//    value and no migration are needed.
//
// Poll-loop-over-timers and ShedLock reasoning mirror RsvpReminderService.
@Service
public class PrintOrderPaymentReconciliationService {

    private static final Logger log = LoggerFactory.getLogger(PrintOrderPaymentReconciliationService.class);

    // Stripe's session payment_status value meaning the couple's payment was actually captured.
    // "no_payment_required" is deliberately NOT treated as paid: print order sessions are plain
    // Mode.PAYMENT sessions with no discounts, so that value appearing at all is an anomaly to
    // WARN about, not silently fulfill.
    static final String PAYMENT_STATUS_PAID = "paid";
    static final String SESSION_STATUS_EXPIRED = "expired";
    static final String SESSION_STATUS_OPEN = "open";

    private final PrintOrderRepository printOrderRepository;
    private final StripePort stripePort;
    private final StripeService stripeService;
    private final int graceMinutes;
    private final int abandonHours;

    public PrintOrderPaymentReconciliationService(
            PrintOrderRepository printOrderRepository,
            StripePort stripePort,
            StripeService stripeService,
            // Grace window: how long a stuck PENDING_PAYMENT order must be before we bother
            // Stripe. Normal webhook delivery lands in seconds; 30 minutes means we never poll
            // for a couple who is simply mid-checkout on a fresh session.
            @Value("${altarwed.print-orders.reconciliation.grace-minutes:30}") int graceMinutes,
            // Abandonment horizon: past this age an order whose session is unpaid is terminal.
            // 48h is double Stripe's maximum (and our default) 24h session lifetime, so by then
            // the session is expired and the expired branch normally already fired; this only
            // exists as a defensive floor so nothing can linger in PENDING_PAYMENT forever.
            @Value("${altarwed.print-orders.reconciliation.abandon-hours:48}") int abandonHours
    ) {
        this.printOrderRepository = printOrderRepository;
        this.stripePort = stripePort;
        this.stripeService = stripeService;
        this.graceMinutes = graceMinutes;
        this.abandonHours = abandonHours;
    }

    // Hourly, mirroring RsvpReminderService: cheap query, and combined with the grace window the
    // worst-case time for a charged couple to converge is ~1.5h -- acceptable next to Lob's own
    // mailing latency. initialDelay staggers it away from the other startup jobs.
    //
    // NOT @Transactional (same reasoning as RsvpReminderService): each per-order write commits
    // as its own unit of work inside the repository adapter's REQUIRES_NEW methods, so one bad
    // order can never mark the whole batch rollback-only and undo the others' transitions.
    @Scheduled(fixedRate = 3_600_000, initialDelay = 180_000)
    @SchedulerLock(name = "PrintOrderPaymentReconciliationService_reconcile",
            lockAtMostFor = "55m", lockAtLeastFor = "1m")
    public void reconcileStuckOrders() {
        // Catches AOP misconfiguration that would silently disable the lock (see
        // RsvpReminderService); tests call LockAssert.TestHelper.makeAllAssertsPass(true).
        LockAssert.assertLocked();
        UUID jobRunId = UUID.randomUUID();
        long startMs = System.currentTimeMillis();
        LocalDateTime now = LocalDateTime.now();

        List<PrintOrder> stuck = printOrderRepository.findPendingPaymentCreatedBefore(now.minusMinutes(graceMinutes));
        log.info("print order payment reconciliation started, jobRunId={}, stuckCount={}", jobRunId, stuck.size());
        if (stuck.isEmpty()) return;

        int recovered = 0;
        int abandoned = 0;
        int stillOpen = 0;
        int skipped = 0;
        int errors = 0;
        for (PrintOrder order : stuck) {
            try {
                switch (reconcile(order, now, jobRunId)) {
                    case RECOVERED -> recovered++;
                    case ABANDONED -> abandoned++;
                    case STILL_OPEN -> stillOpen++;
                    case SKIPPED -> skipped++;
                }
            } catch (Exception ex) {
                // One order's Stripe/DB failure must never abort the rest of the batch: every
                // remaining stuck order is potentially a charged couple waiting on their mail.
                errors++;
                log.warn("print order payment reconciliation failed for order, jobRunId={}, orderId={}",
                         jobRunId, order.id(), ex);
            }
        }
        // Every recovered order is a webhook Stripe gave up on (or that we dropped): recovered>0
        // is the health signal that the webhook endpoint itself needs attention.
        log.info("print order payment reconciliation finished, jobRunId={}, recovered={}, abandoned={}, "
                        + "stillOpen={}, skipped={}, errors={}, durationMs={}",
                 jobRunId, recovered, abandoned, stillOpen, skipped, errors,
                 System.currentTimeMillis() - startMs);
    }

    private enum Outcome { RECOVERED, ABANDONED, STILL_OPEN, SKIPPED }

    private Outcome reconcile(PrintOrder order, LocalDateTime now, UUID jobRunId) {
        UUID orderId = order.id();
        if (order.stripeCheckoutSessionId() == null) {
            // A Stripe outage at order creation (session create or attach failed): there is no
            // session to reconcile against and no charge can ever have happened. Left for a
            // human; deliberately not auto-failed, to keep this job's write set exactly the two
            // webhook-equivalent transitions.
            log.warn("print order payment reconciliation skipped, no checkout session on order, jobRunId={}, orderId={}",
                     jobRunId, orderId);
            return Outcome.SKIPPED;
        }

        CheckoutSessionStatus session = stripePort.retrieveCheckoutSessionStatus(order.stripeCheckoutSessionId());

        // Paid wins over everything else, including age past the abandonment horizon: a charged
        // couple must always converge to fulfillment, never to FAILED.
        if (PAYMENT_STATUS_PAID.equals(session.paymentStatus())) {
            boolean won = stripeService.confirmPrintOrderPayment(orderId, session.paymentIntentId());
            if (won) {
                // WARN, not INFO: this exact order's checkout.session.completed webhook was lost.
                log.warn("print order payment reconciled from lost webhook, jobRunId={}, orderId={}", jobRunId, orderId);
                return Outcome.RECOVERED;
            }
            // The webhook (or a concurrent run) landed between our query and the CAS -- already
            // converged, nothing left to do.
            log.info("print order payment reconciliation no-op, order already resolved, jobRunId={}, orderId={}",
                     jobRunId, orderId);
            return Outcome.SKIPPED;
        }

        if (SESSION_STATUS_EXPIRED.equals(session.sessionStatus())) {
            // Unpaid and Stripe says the session is dead: the checkout.session.expired webhook
            // was lost too. Same transition it would have made.
            boolean won = stripeService.failPrintOrderPayment(orderId, StripeService.CHECKOUT_EXPIRED_MESSAGE);
            if (won) {
                log.warn("print order abandoned checkout reconciled from lost webhook, jobRunId={}, orderId={}",
                         jobRunId, orderId);
                return Outcome.ABANDONED;
            }
            return Outcome.SKIPPED;
        }

        if (SESSION_STATUS_OPEN.equals(session.sessionStatus())) {
            if (order.createdAt() != null && order.createdAt().isBefore(now.minusHours(abandonHours))) {
                // Defensive floor only: Stripe caps session lifetime at 24h, so an open session
                // at 48h should be impossible. If it ever happens, terminate the order rather
                // than let it poll forever.
                boolean won = stripeService.failPrintOrderPayment(orderId, StripeService.CHECKOUT_EXPIRED_MESSAGE);
                if (won) {
                    log.warn("print order abandoned past horizon with session still open, jobRunId={}, orderId={}",
                             jobRunId, orderId);
                    return Outcome.ABANDONED;
                }
                return Outcome.SKIPPED;
            }
            // The couple may still be on the hosted Checkout page: leave it, the webhook or a
            // later run will converge it.
            return Outcome.STILL_OPEN;
        }

        // complete-but-unpaid ("no_payment_required") or an unknown future status: never fulfill
        // without a captured payment, never fail a session Stripe calls complete. Human signal.
        log.warn("print order payment reconciliation left order untouched, unexpected session state, "
                        + "jobRunId={}, orderId={}, sessionStatus={}, paymentStatus={}",
                 jobRunId, orderId, session.sessionStatus(), session.paymentStatus());
        return Outcome.SKIPPED;
    }
}
