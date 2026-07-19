# CHECKLIST: Attorney review packet (issue #248, plus #387)

Purpose: everything counsel needs in one sitting, with repo/site locations, so the review
is a fixed-fee document pass, not a discovery project. The compliance plumbing (one-click
unsubscribe, suppression audit trail, consent-gated pixel, hard-delete cascade,
/do-not-sell) is already built; what remains are judgment calls only a licensed attorney
can make. This checklist is not legal advice.

## Documents to hand counsel

| Document | Live URL | Source in repo |
|---|---|---|
| Privacy Policy | altarwed.com/privacy | `frontend-public/src/app/privacy/page.tsx` |
| Terms of Service | altarwed.com/terms | `frontend-public/src/app/terms/page.tsx` |
| Auto-renewal disclosure (vendor Pro subscription) | app.altarwed.com vendor subscription page | `frontend-app/src/features/vendor/VendorSubscriptionPage.tsx` (`AUTO_RENEWAL_DISCLOSURE_HEADING/BODY`, shipped in PR #402 for issue #386; engineering closed it, counsel sign-off on the copy is still outstanding) |
| CAN-SPAM / unsubscribe flow description | footer links in guest emails | `backend/.../infrastructure/email/ResendEmailAdapter.java:309-310` (List-Unsubscribe + One-Click headers), suppression model in `backend/docs/SCHEMA.md` (EmailSuppression V47, CoupleEmailOptOut V69, append-only EmailSubscriptionEvent V68 audit trail) |
| Do Not Sell / consent controls | altarwed.com/do-not-sell | `frontend-public/src/app/do-not-sell/page.tsx` + GPC handling in `FacebookPixel.tsx` |
| Affiliate disclosure | altarwed.com/resources | `frontend-public/src/app/resources/page.tsx:88,128` (Amazon Associates language, `rel="sponsored"` on affiliate links at line 136) |
| Guest-data controller clause + DMCA section + guest deletion path | in Terms/Privacy | drafted and merged via issue #243 (Terms section 5 "Guest Information You Add", section 11 "Copyright Complaints (DMCA)") |

## Specific questions for counsel (from #248 and #387)

1. Governing law and venue (#387): Terms section 16 (`terms/page.tsx:131-133`) says
   "laws of the United States" and "courts located in the United States". Not a valid
   choice of law and no single venue exists. Pick a home state; decide arbitration
   clause and class-action waiver while at it.
2. Subprocessor list gaps (#387): Privacy section 5 (`privacy/page.tsx:62-72`) lists
   Azure, Resend, Google, PostHog, Meta, Lob but NOT Stripe, which is live. Add Stripe;
   confirm signed DPAs/SCCs exist for each before EU traffic. Also reconcile the
   PostHog wording: Privacy section 8 says PostHog is gated on cookie consent, the code
   gates on marketing consent.
3. Controller/processor allocation for couple-uploaded guest PII, and whether a DPA
   with each couple is needed (drafted clause shipped via #243; validate it).
4. Hashed-email retention after account deletion: SHA-256 email hashes are kept in an
   append-only audit table for CAN-SPAM defensibility (`backend/docs/SCHEMA.md`,
   EmailSubscriptionEvent). Is that defensible under GDPR storage limitation?
5. COPPA posture for child guests entered by couples (`privacy/page.tsx` children
   section vs the guest path having no age gate).
6. Auto-renewal: does the shipped disclosure + Stripe Customer Portal cancellation
   satisfy FTC click-to-cancel and state ARLs (CA S17600)? Are renewal-reminder emails
   required for our terms?
7. EU/EEA posture if ads reach EU users; confirm policy claims match the pixel
   implementation (consent-gated, GPC honored).
8. Enforceability of the USD 100 liability cap and as-is disclaimer (Terms sections
   12-13) in the chosen governing state.
9. PostHog DPA coverage given product analytics on authenticated users.

## Administrative (cheap, do alongside)

- [ ] Register a DMCA agent with the US Copyright Office (~USD 6; the Terms DMCA
  section from #243 assumes an agent exists).
- [ ] Record counsel's chosen state, then file the Terms/Privacy text changes as an
  agent-implementable issue (the edits are trivial once the decisions are made).

## Jordan-only

Selecting counsel, paying for the review, the DMCA registration, and signing DPAs are
all human actions. The repo-side text edits that fall out of the review can go to the
implementer agent afterward.
