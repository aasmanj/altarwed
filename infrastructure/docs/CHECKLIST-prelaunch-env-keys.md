# CHECKLIST: Pre-launch environment keys (issue #247)

Every key below either silently disables a launch-critical behavior when blank
(empty-default guard `${X:}` in `backend/src/main/resources/application.yml`) or is baked
into a frontend bundle at build time. Where each is set follows the split documented in
`infrastructure/CLAUDE.md`: backend secrets live in Key Vault `altarwed-prod-kv` and are
wired as `@Microsoft.KeyVault(...)` references in `modules/app-service.bicep`; frontend
values are GitHub Actions secrets consumed at build time by `deploy-app.yml` /
`deploy-landing.yml`; the landing SWA additionally has runtime app settings set via
`az staticwebapp appsettings set`.

## The launch three

### 1. Turnstile (RSVP anti-enumeration, the #89 control)

- [ ] `TURNSTILE-SECRET-KEY` in Key Vault, non-empty:
  `az keyvault secret show --vault-name altarwed-prod-kv --name TURNSTILE-SECRET-KEY --query "value!=null && value!=''"`
- [ ] App Service setting `TURNSTILE_SECRET_KEY` resolves the KV reference
  (`app-service.bicep:114`): Portal -> altarwed-prod-api -> Environment variables ->
  the KV reference shows a green check, or
  `az webapp config appsettings list -g altarwed-rg -n altarwed-prod-api --query "[?name=='TURNSTILE_SECRET_KEY']"`
- [ ] `NEXT_PUBLIC_TURNSTILE_SITE_KEY` GitHub secret set (consumed in
  `deploy-landing.yml:73`, rendered by
  `frontend-public/src/app/wedding/[slug]/rsvp/FindInvitationWidget.tsx:75`).
- Outside-in verify: open `https://www.altarwed.com/wedding/<slug>/rsvp`, confirm the
  Turnstile widget renders (a request to `challenges.cloudflare.com` fires). Then
  submit the find-invitation form with devtools blocking the widget, or
  `curl -s -X POST` the find endpoint without a token, and confirm a captcha rejection,
  not results.
- Fail-closed interaction with #413: `TurnstileStartupValidator`
  (`backend/.../infrastructure/security/TurnstileStartupValidator.java`) refuses to
  boot the prod profile when the secret is blank. That converts "silently fails open"
  into "next deploy does not start". So this key is now a deploy gate: verify it BEFORE
  the next backend deploy, because a blank value takes the API down rather than
  degrading quietly. #413's remaining human action is exactly this verification.

### 2. PostHog (product funnel: signed_up / website_published / share_clicked)

- [ ] GitHub secrets `VITE_POSTHOG_KEY` and `VITE_POSTHOG_HOST` set
  (`deploy-app.yml:49-50`; host should be the managed reverse proxy
  `https://f.altarwed.com` per `frontend-app/src/core/analytics/analytics.ts:15`).
  `gh secret list --repo aasmanj/altarwed` shows presence (not values).
- Outside-in verify: open `https://app.altarwed.com`, accept the consent banner, and in
  devtools Network confirm beacons to `f.altarwed.com` (capture/`/e` requests). Then
  confirm the event appears in the PostHog project Live Events. If unset, the entire
  funnel is dark and only `/admin/metrics` DB counts remain (no error is shown).

### 3. Meta Pixel (ad attribution, CompleteRegistration)

- [ ] `NEXT_PUBLIC_FB_PIXEL_ID` GitHub secret set (`deploy-landing.yml:68`, consumed by
  `frontend-public/src/components/FacebookPixel.tsx`).
- [ ] `VITE_FB_PIXEL_ID` GitHub secret set (`deploy-app.yml:51`, consumed by
  `frontend-app/src/core/analytics/metaPixel.ts:103`; shipped by #221 so the signup
  domain can report CompleteRegistration).
- [ ] Backend CAPI pair in Key Vault: `META-PIXEL-ID` and `META-CAPI-ACCESS-TOKEN`
  (`app-service.bicep:205-211`; blank no-ops server-side events per
  `application.yml:189-190`).
- Outside-in verify: with consent accepted and no GPC signal, confirm a request to
  `facebook.com/tr?id=<pixel>&ev=PageView` on www, then complete a test signup on
  app.altarwed.com and watch `CompleteRegistration` arrive in Meta Events Manager
  (Test Events tab). Note the pixel is consent-gated: rejecting the banner or sending
  GPC correctly suppresses it, so test with a clean accepting profile.

## Other empty-default keys to confirm present (behavior degrades silently if blank)

All are already declared in `modules/app-service.bicep` as KV references;
`infrastructure/CLAUDE.md` records all KV secrets as present. Spot-check the ones whose
absence would embarrass a launch:

- [ ] `RESEND-API-KEY`, `RESEND-WEBHOOK-SECRET` (emails silently unsent; webhook
  fails closed)
- [ ] `REVALIDATION-SECRET` in KV AND as a runtime app setting on the landing SWA
  (`az staticwebapp appsettings list -n altarwed-landing`); mismatch means publish
  actions stop purging the public page cache
- [ ] Landing SWA runtime settings: `RESEND_API_KEY`, `RESEND_AUDIENCE_ID`,
  `APPLICATIONINSIGHTS_CONNECTION_STRING` (per `infrastructure/CLAUDE.md`)
- [ ] `STRIPE-SECRET-KEY`, `STRIPE-WEBHOOK-SECRET`, `STRIPE-PRICE-PRO-MONTHLY`,
  `STRIPE-PRICE-PRO-ANNUAL` (billing live, so these must already be right; verify a
  test checkout still opens)
- [ ] `UNSUBSCRIBE-SECRET`, `POSTAL-ADDRESS` (CAN-SPAM footer and one-click headers)
- [ ] `GOOGLE-OAUTH-*` including `GOOGLE-OAUTH-TOKEN-ENCRYPTION-KEY` (Sheets sync goes
  dark for connected couples if the encryption key is missing, see the release-ordering
  note in `app-service.bicep:126-143`)
- [ ] `AZURE-STORAGE-CONNECTION-STRING` plus `BLOB_PUBLIC_BASE_URL` app setting
  (photo upload/display)

## Sign-off

- [ ] All three launch keys verified from the outside (widget renders, beacon fires,
  pixel event lands), not just present in config.
- [ ] Date + verifier recorded in the issue (#247) before ad spend starts.
