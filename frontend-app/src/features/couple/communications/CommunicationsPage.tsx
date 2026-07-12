import { useEffect, useCallback, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { Mail, Send, AlertCircle, Loader2, RefreshCw, ShieldCheck, ExternalLink } from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import { useAuth } from '@/core/auth/AuthContext'
import { useConfirm } from '@/components/ConfirmDialog'
import PageHeader from '@/components/PageHeader'
import { AnimatedModal } from '@/components/AnimatedModal'
import { useGuests } from '@/features/couple/guests/useGuests'
import {
  usePrintOrders,
  useCreatePrintOrder,
  useRefreshPrintOrderStatus,
  type CreatePrintOrderPayload,
  type CreatePrintOrderResult,
  type PrintOrder,
  type PrintOrderType,
  type CardSize,
} from './usePrintOrders'
import { useWeddingWebsite } from '@/features/couple/website/useWeddingWebsite'
import { coupleDisplayName } from '@/lib/coupleName'
import { errorDetail } from '@/lib/apiError'
import { formatShortDate } from '@/lib/date'
import {
  type BaseTemplateKey,
  type TextPosition,
  type OverlayTextTheme,
  DEFAULT_TEXT_POSITION,
  DEFAULT_OVERLAY_THEME,
  TEXT_POSITIONS,
  composePrintTemplateKey,
  basePrintTemplateKey,
  isPhotoTemplate,
  styleOf,
  overlayPlacement,
} from './printTemplate'

// Base design keys (issue #362 adds Minimal, Botanical, Dark Elegant to the original Classic/Photo).
// The PHOTO overlay position + light/dark theme are composed onto the key only at submit time.
type TemplateKey = BaseTemplateKey

const TEMPLATES: Record<PrintOrderType, { key: TemplateKey; label: string; description: string }[]> = {
  SAVE_THE_DATE: [
    { key: 'SAVE_THE_DATE_CLASSIC', label: 'Classic', description: 'Cream + gold, no photo. Best when you don\'t yet have a couple portrait.' },
    { key: 'SAVE_THE_DATE_PHOTO', label: 'Photo', description: 'Full-bleed hero photo with names and date overlaid.' },
    { key: 'SAVE_THE_DATE_MINIMAL', label: 'Minimal', description: 'Clean white card with a hairline frame in your accent color.' },
    { key: 'SAVE_THE_DATE_BOTANICAL', label: 'Botanical', description: 'Soft ivory with a botanical accent border and sprig.' },
    { key: 'SAVE_THE_DATE_DARK_ELEGANT', label: 'Dark elegant', description: 'Dramatic charcoal card with your accent as the divider.' },
  ],
  INVITATION: [
    { key: 'INVITATION_CLASSIC', label: 'Classic', description: 'Cream + gold, scripture footer, ceremony details on back.' },
    { key: 'INVITATION_PHOTO', label: 'Photo', description: 'Full-bleed hero photo with formal invitation copy.' },
    { key: 'INVITATION_MINIMAL', label: 'Minimal', description: 'Clean white card with a hairline frame in your accent color.' },
    { key: 'INVITATION_BOTANICAL', label: 'Botanical', description: 'Soft ivory with a botanical accent border and sprig.' },
    { key: 'INVITATION_DARK_ELEGANT', label: 'Dark elegant', description: 'Dramatic charcoal card with your accent as the divider.' },
  ],
}

const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  SAVE_THE_DATE_CLASSIC: 'Save the Date - Classic',
  SAVE_THE_DATE_PHOTO: 'Save the Date - Photo',
  SAVE_THE_DATE_MINIMAL: 'Save the Date - Minimal',
  SAVE_THE_DATE_BOTANICAL: 'Save the Date - Botanical',
  SAVE_THE_DATE_DARK_ELEGANT: 'Save the Date - Dark elegant',
  INVITATION_CLASSIC: 'Invitation - Classic',
  INVITATION_PHOTO: 'Invitation - Photo',
  INVITATION_MINIMAL: 'Invitation - Minimal',
  INVITATION_BOTANICAL: 'Invitation - Botanical',
  INVITATION_DARK_ELEGANT: 'Invitation - Dark elegant',
}

// The card accent falls back to this warm gold when the couple hasn't set a website accentColor,
// mirroring the backend Lob adapter's DEFAULT_ACCENT so the preview matches the printed card.
const DEFAULT_ACCENT = '#a08060'

// Guard the couple-controlled accent to a strict hex literal before it reaches inline preview CSS,
// exactly like the backend sanitizeAccent(); anything else falls back to the default gold.
function sanitizeAccent(accent: string | null | undefined): string {
  if (!accent) return DEFAULT_ACCENT
  const a = accent.trim()
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(a) ? a : DEFAULT_ACCENT
}

// Card shape/size options. `aspect` drives the live preview; `portrait` flips the preview layout
// (bottom text band + full-height photo) and must stay in sync with the backend Lob adapter's
// dimsFor(): LANDSCAPE_6X11 -> 6x11 landscape, PORTRAIT_6X9 -> 6x9 upright, PORTRAIT_5X7 -> 5x7 upright.
const CARD_SIZES: { key: CardSize; label: string; sub: string; aspect: string; portrait: boolean }[] = [
  { key: 'LANDSCAPE_6X11', label: 'Landscape', sub: '6" x 11" postcard', aspect: '11 / 6', portrait: false },
  { key: 'PORTRAIT_6X9', label: 'Portrait', sub: '6" x 9" postcard', aspect: '6 / 9', portrait: true },
  { key: 'PORTRAIT_5X7', label: 'Portrait petite', sub: '5" x 7" card', aspect: '5 / 7', portrait: true },
]

// AltarWed fallback verse, mirrored from the backend Lob adapter, shown when the couple hasn't
// chosen a scripture on their wedding website yet.
const DEFAULT_VERSE_TEXT = 'Above all, love each other deeply.'
const DEFAULT_VERSE_REF = '1 Peter 4:8'

// Mirrors backend COST_PER_POSTCARD_CENTS = 200 in PrintOrderService (issue #59).
const COST_PER_POSTCARD_CENTS = 200

export default function CommunicationsPage() {
  const { user } = useAuth()
  const confirm = useConfirm()
  const coupleId = user?.id ?? ''
  const { data: website, isLoading: websiteLoading } = useWeddingWebsite(coupleId)
  const { data: guests = [], isLoading: guestsLoading, isError: guestsError, refetch: refetchGuests } = useGuests(coupleId)
  const { data: orders = [], isLoading: ordersLoading, isError: ordersError, refetch: refetchOrders } = usePrintOrders(coupleId)
  const createOrder = useCreatePrintOrder(coupleId)
  const [searchParams, setSearchParams] = useSearchParams()

  const [orderType, setOrderType] = useState<PrintOrderType>('SAVE_THE_DATE')
  const [templateKey, setTemplateKey] = useState<TemplateKey>('SAVE_THE_DATE_CLASSIC')
  const [cardSize, setCardSize] = useState<CardSize>('LANDSCAPE_6X11')
  // Issue #362: photo-overlay customization. Only meaningful for a PHOTO template; composed onto
  // the templateKey at submit time. Defaults match the original photo card (bottom-center, light).
  const [textPosition, setTextPosition] = useState<TextPosition>(DEFAULT_TEXT_POSITION)
  const [overlayTheme, setOverlayTheme] = useState<OverlayTextTheme>(DEFAULT_OVERLAY_THEME)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [returnName, setReturnName] = useState(
    user?.partnerOneName && user?.partnerTwoName
      ? `${user.partnerTwoName} & ${user.partnerOneName}`
      : ''
  )
  const [returnAddressLine1, setReturnAddressLine1] = useState('')
  const [returnAddressLine2, setReturnAddressLine2] = useState('')
  const [returnCity, setReturnCity] = useState('')
  const [returnState, setReturnState] = useState('')
  const [returnZip, setReturnZip] = useState('')
  const [lastResult, setLastResult] = useState<string | null>(null)
  // Issue #59: the order is created (and validated/priced) before any charge, but nothing is
  // sent to Lob and no card is charged until the couple confirms on THIS panel and completes
  // Stripe Checkout. Holds the just-created order's exact charge, warnings, and exclusions.
  const [pendingCheckout, setPendingCheckout] = useState<CreatePrintOrderResult | null>(null)
  // Dedup token regenerated whenever the batch contents change (see effect below),
  // so each distinct batch is a new order server-side. A retry of the SAME batch
  // keeps the key and is deduped by the backend.
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => crypto.randomUUID())

  // Regenerate the dedup key whenever the batch contents change, so each distinct
  // batch is treated as a new order. A retry of the SAME batch (selection/template
  // unchanged, e.g. after a transient failure) keeps the key and is deduped
  // server-side. Clearing the selection after a success also rotates the key.
  useEffect(() => {
    setIdempotencyKey(crypto.randomUUID())
  }, [orderType, templateKey, cardSize, textPosition, overlayTheme, selectedIds])

  const isPhoto = isPhotoTemplate(templateKey)
  const accent = sanitizeAccent(website?.accentColor)
  // The full templateKey sent to the backend: base design plus, for a photo card, the chosen
  // overlay position + theme suffix. Non-photo templates ignore the overlay entirely.
  const composedTemplateKey = composePrintTemplateKey(templateKey, textPosition, overlayTheme)

  // Issue #59: the couple lands back here after Stripe Checkout via successUrl/cancelUrl. Show
  // what happened, refetch orders (once immediately, once after a short delay to catch the async
  // Lob batch finishing -- issue #53), then strip the query params so a page refresh doesn't
  // re-trigger the banner.
  useEffect(() => {
    const printOrderParam = searchParams.get('printOrder')
    if (!printOrderParam) return
    if (printOrderParam === 'success') {
      setLastResult('Payment received. Your postcards are being submitted now -- refresh Past orders below in a few seconds for the final status.')
      refetchOrders()
      const t = setTimeout(() => refetchOrders(), 3000)
      setSearchParams(prev => { const next = new URLSearchParams(prev); next.delete('printOrder'); next.delete('orderId'); return next }, { replace: true })
      return () => clearTimeout(t)
    }
    if (printOrderParam === 'cancelled') {
      setLastResult('Checkout was cancelled. You were not charged, and nothing was mailed.')
      setSearchParams(prev => { const next = new URLSearchParams(prev); next.delete('printOrder'); next.delete('orderId'); return next }, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const mailableGuests = useMemo(
    () => guests.filter(g => g.mailLine1 && g.mailLine1.trim().length > 0),
    [guests]
  )

  const guestById = useMemo(
    () => new Map(guests.map(g => [g.id, g])),
    [guests]
  )

  const eligibleSelected = selectedIds.filter(id => mailableGuests.some(g => g.id === id))
  const internationalSelectedCount = eligibleSelected.filter(id => guestById.get(id)?.mailCountry).length
  const estimatedCostDollars = (eligibleSelected.length * COST_PER_POSTCARD_CENTS) / 100

  function toggleType(t: PrintOrderType) {
    setOrderType(t)
    setTemplateKey(TEMPLATES[t][0].key)
  }

  function toggleGuest(id: string) {
    setSelectedIds(curr => curr.includes(id) ? curr.filter(x => x !== id) : [...curr, id])
  }

  function selectAllMailable() {
    setSelectedIds(mailableGuests.map(g => g.id))
  }

  function clearSelection() {
    setSelectedIds([])
  }

  // Inline validation hints shown below each relevant field when the form has
  // been touched but the field is still invalid.
  const stateInvalid = returnState.trim().length > 0 && returnState.trim().length !== 2
  const zipInvalid = returnZip.trim().length > 0 && !/^\d{5}(-\d{4})?$/.test(returnZip.trim())

  // Single source of truth for submit readiness. `canSubmit` is derived from
  // the hint so the validation rules can't drift between the two.
  function submitBlockerHint(): string | null {
    // Don't let a couple pay for a photo card with no photo: the async Lob batch would build a
    // blank-hero card (or Lob rejects it) only after the charge. Block it before checkout.
    if (templateKey.endsWith('_PHOTO') && !websiteLoading && !website?.heroPhotoUrl) {
      return 'Upload a couple photo on your wedding website to use a Photo card, or pick a Classic template'
    }
    if (eligibleSelected.length === 0) return 'Select at least one recipient above'
    if (!returnName.trim()) return 'Enter a name for the return address'
    if (!returnAddressLine1.trim()) return 'Enter address line 1'
    if (!returnCity.trim()) return 'Enter the city'
    if (returnState.trim().length !== 2) return 'Enter a 2-letter state code (e.g. CA)'
    if (!/^\d{5}(-\d{4})?$/.test(returnZip.trim())) return 'Enter a valid 5-digit ZIP'
    return null
  }

  const blocker = submitBlockerHint()
  const canSubmit = blocker === null

  async function handleSubmit() {
    if (createOrder.isPending) return
    const confirmed = await confirm({
      title: 'Continue to secure payment?',
      message: `You'll review the exact charge and then be sent to Stripe's secure checkout to pay. Nothing is mailed and no card is charged until payment completes. Estimated: $${estimatedCostDollars.toFixed(2)} for up to ${eligibleSelected.length} postcards (any address we can't verify is excluded before you pay).`,
      confirmLabel: 'Continue',
      tone: 'default',
    })
    if (!confirmed) return

    const payload: CreatePrintOrderPayload = {
      orderType,
      templateKey: composedTemplateKey,
      guestIds: eligibleSelected,
      returnName: returnName.trim(),
      returnAddressLine1: returnAddressLine1.trim(),
      returnAddressLine2: returnAddressLine2.trim() || undefined,
      returnCity: returnCity.trim(),
      returnState: returnState.trim().toUpperCase(),
      returnZip: returnZip.trim(),
      idempotencyKey,
      cardSize,
    }
    try {
      const result = await createOrder.mutateAsync(payload)
      if (!result.checkoutUrl) {
        // Idempotent replay: an order for this exact batch already exists (double submit).
        setLastResult('This batch was already submitted. Check Past orders below for its status.')
        return
      }
      // Always show the review panel before redirecting -- even with no warnings/exclusions,
      // the couple should see the exact charge and postcard count before leaving for Stripe.
      setPendingCheckout(result)
    } catch (err) {
      // Spring ProblemDetail puts the reason in `detail`, not `message`; reading
      // `.message` (the old code) always missed it and showed "Unknown error".
      const fallback = (err as { message?: string })?.message ?? 'Unknown error'
      setLastResult(`Failed to submit: ${errorDetail(err, fallback)}`)
      // Keep the SAME key on failure: if the couple retries, the backend dedups
      // in case the batch actually went through before the error surfaced.
    }
  }

  function confirmPayment() {
    if (!pendingCheckout?.checkoutUrl) return
    window.location.href = pendingCheckout.checkoutUrl
  }

  function cancelPendingCheckout() {
    // The order stays PENDING_PAYMENT server-side and expires on its own (Stripe's 24h
    // Checkout Session window), no cleanup needed here.
    setPendingCheckout(null)
    setLastResult('Order not sent to payment. It will expire on its own -- nothing was charged.')
  }

  return (
    <div className="min-h-screen bg-ivory">
      <PageHeader
        title="Communications"
        subtitle="Send digital + physical save-the-dates and invitations"
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-10">

        {/* Channel chooser */}
        <section aria-labelledby="channel-heading">
          <h2 id="channel-heading" className="font-serif text-2xl font-bold text-brown mb-2">How would you like to reach your guests?</h2>
          <p className="text-sm text-stone-500 mb-5">Choose email for instant free delivery, or order printed postcards mailed to their door.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <a
              href="#email-section"
              className="flex items-start gap-4 rounded-xl border-2 border-gold-light bg-white p-5 hover:border-amber-400 hover:shadow-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              <Mail className="w-6 h-6 text-amber-600 mt-0.5 flex-shrink-0" aria-hidden="true" />
              <div>
                <p className="font-semibold text-brown mb-0.5">Email <span className="text-xs font-normal text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5 ml-1">Free</span></p>
                <p className="text-sm text-stone-500">Send save-the-dates and RSVP invitations straight to your guests&apos; inboxes.</p>
              </div>
            </a>
            <a
              href="#print-section"
              className="flex items-start gap-4 rounded-xl border-2 border-gold-light bg-white p-5 hover:border-amber-400 hover:shadow-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              <Send className="w-6 h-6 text-amber-600 mt-0.5 flex-shrink-0" aria-hidden="true" />
              <div>
                <p className="font-semibold text-brown mb-0.5">Print &amp; Mail <span className="text-xs font-normal text-stone-500">$2.00/card</span></p>
                <p className="text-sm text-stone-500">We print and mail physical postcards to guests who have a mailing address on file -- you never touch a stamp or envelope.</p>
              </div>
            </a>
          </div>
        </section>

        {/* Email section */}
        <section id="email-section" aria-labelledby="email-heading">
          <span className="text-xs font-semibold uppercase tracking-wide text-amber-700">Email</span>
          <h2 id="email-heading" className="font-serif text-xl font-bold text-brown mb-1 mt-1">Email your guests</h2>
          <p className="text-sm text-stone-500 mb-4">Two faith-themed emails, both free. Send the save-the-date first, then RSVP invitations closer to the day.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Link
              to="/dashboard/save-the-date"
              className="flex flex-col rounded-xl border border-gold-light bg-white p-5 hover:shadow-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-1">First - Free</span>
              <h3 className="font-serif text-lg font-semibold text-brown mb-1">Save-the-dates</h3>
              <p className="text-sm text-brown-light flex-1">A one-time announcement emailed to everyone with an email address. Send it months ahead so guests can plan.</p>
              <span className="mt-3 text-sm font-medium text-amber-700">Go to save-the-dates &rarr;</span>
            </Link>
            <Link
              to="/dashboard/guests"
              className="flex flex-col rounded-xl border border-gold-light bg-white p-5 hover:shadow-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-1">Then - Free</span>
              <h3 className="font-serif text-lg font-semibold text-brown mb-1">RSVP invitations</h3>
              <p className="text-sm text-brown-light flex-1">Send to your whole guest list at once, or one guest at a time, from your guest list. Each person gets their own RSVP link. Up to 3 sends per guest.</p>
              <span className="mt-3 text-sm font-medium text-amber-700">Open guest list to send &rarr;</span>
            </Link>
          </div>
        </section>

        {/* Print & Mail section */}
        <section id="print-section" className="rounded-xl border border-stone-200 bg-white p-6" aria-labelledby="print-heading">
          <span className="text-xs font-semibold uppercase tracking-wide text-amber-700">Print &amp; Mail</span>
          <h2 id="print-heading" className="font-serif text-xl font-bold text-brown mb-1 mt-1">Order physical postcards</h2>
          <p className="text-sm text-stone-500 mb-2">
            Postcards are printed and mailed via a third-party service (Lob) with first-class USPS postage included --
            you never touch a stamp, envelope, or trip to the post office.
          </p>
          <ul className="text-sm text-stone-500 mb-6 space-y-1 list-disc list-inside">
            <li>Flat <strong className="text-stone-700">$2.00 per postcard</strong>, charged securely via Stripe only after you review the exact amount below.</li>
            <li>US addresses are checked for USPS deliverability before you pay -- an address we can&apos;t verify is excluded and you&apos;re never charged for it.</li>
            <li>Once mailed, we show real USPS tracking (tracking number + expected delivery date) as it becomes available. USPS First-Class Mail does not offer a guaranteed delivery date, so this is our best real-time information, not a guarantee.</li>
            <li>International addresses are mailed but can&apos;t be independently verified before sending (Lob&apos;s verification only covers US addresses).</li>
          </ul>

          {/* 1. Order type */}
          <div className="mb-5" role="group" aria-labelledby="order-type-label">
            <p id="order-type-label" className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">1. What are you sending?</p>
            <div className="flex flex-wrap gap-2">
              {(['SAVE_THE_DATE', 'INVITATION'] as PrintOrderType[]).map(t => (
                <button
                  key={t}
                  onClick={() => toggleType(t)}
                  aria-pressed={orderType === t}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border ${
                    orderType === t
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
                  }`}
                >
                  {t === 'SAVE_THE_DATE' ? 'Save the Date' : 'Invitation'}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Template picker */}
          <div className="mb-5" role="group" aria-labelledby="template-label">
            <p id="template-label" className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">2. Choose a template</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {TEMPLATES[orderType].map(t => (
                <button
                  key={t.key}
                  onClick={() => setTemplateKey(t.key)}
                  aria-pressed={templateKey === t.key}
                  className={`text-left p-4 rounded-lg border ${
                    templateKey === t.key
                      ? 'border-amber-600 bg-amber-50'
                      : 'border-stone-200 bg-white hover:bg-stone-50'
                  }`}
                >
                  <p className="font-semibold text-stone-800">{t.label}</p>
                  <p className="text-xs text-stone-500 mt-1">{t.description}</p>
                </button>
              ))}
            </div>
            {/* Shape / orientation picker */}
            <div className="mt-4" role="group" aria-labelledby="cardsize-label">
              <p id="cardsize-label" className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">Shape &amp; size</p>
              <div className="flex flex-wrap gap-2">
                {CARD_SIZES.map(s => (
                  <button
                    key={s.key}
                    onClick={() => setCardSize(s.key)}
                    aria-pressed={cardSize === s.key}
                    className={`text-left px-3 py-2 rounded-lg border ${
                      cardSize === s.key
                        ? 'border-amber-600 bg-amber-50'
                        : 'border-stone-200 bg-white hover:bg-stone-50'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className={`inline-block rounded-sm border ${cardSize === s.key ? 'border-amber-500 bg-amber-200' : 'border-stone-300 bg-stone-100'}`}
                        style={s.portrait ? { width: 12, height: 16 } : { width: 18, height: 11 }}
                      />
                      <span>
                        <span className="block text-sm font-medium text-stone-800">{s.label}</span>
                        <span className="block text-xs text-stone-500">{s.sub}</span>
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Photo-overlay controls (issue #362): only meaningful for a Photo template. */}
            {isPhoto && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div role="group" aria-labelledby="overlay-theme-label">
                  <p id="overlay-theme-label" className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">Overlay text</p>
                  <div className="flex gap-2">
                    {([
                      { key: 'LIGHT' as OverlayTextTheme, label: 'Light text' },
                      { key: 'DARK' as OverlayTextTheme, label: 'Dark text' },
                    ]).map(o => (
                      <button
                        key={o.key}
                        onClick={() => setOverlayTheme(o.key)}
                        aria-pressed={overlayTheme === o.key}
                        className={`px-3 py-2 rounded-lg border text-sm font-medium ${
                          overlayTheme === o.key
                            ? 'border-amber-600 bg-amber-50 text-stone-800'
                            : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-stone-500 mt-1.5">Light for dark photos, dark for bright photos.</p>
                </div>
                <div role="group" aria-labelledby="text-position-label">
                  <p id="text-position-label" className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">Text position</p>
                  <div className="grid grid-cols-3 gap-1 w-max" role="radiogroup" aria-labelledby="text-position-label">
                    {TEXT_POSITIONS.map(pos => (
                      <button
                        key={pos}
                        role="radio"
                        aria-checked={textPosition === pos}
                        aria-label={`Text ${pos.toLowerCase().replace('_', ' ')}`}
                        onClick={() => setTextPosition(pos)}
                        className={`w-8 h-8 rounded border flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold ${
                          textPosition === pos
                            ? 'border-amber-600 bg-amber-100'
                            : 'border-stone-300 bg-white hover:bg-stone-50'
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`w-2 h-2 rounded-full ${textPosition === pos ? 'bg-amber-600' : 'bg-stone-300'}`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <PostcardPreview
              templateKey={templateKey}
              cardSize={cardSize}
              accent={accent}
              textPosition={textPosition}
              overlayTheme={overlayTheme}
              user={user!}
              heroPhotoUrl={website?.heroPhotoUrl ?? null}
              websiteLoading={websiteLoading}
              weddingUrl={website ? `https://www.altarwed.com/wedding/${website.slug}` : null}
              scriptureText={website?.scriptureText ?? null}
              scriptureReference={website?.scriptureReference ?? null}
              returnName={returnName}
              returnAddressLine1={returnAddressLine1}
              returnAddressLine2={returnAddressLine2}
              returnCity={returnCity}
              returnState={returnState}
              returnZip={returnZip}
            />
          </div>

          {/* 3. Guest list */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <p id="recipients-label" className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                3. Pick recipients
                {!guestsLoading && !guestsError && ` (${mailableGuests.length} have a mailing address)`}
              </p>
              {!guestsLoading && !guestsError && mailableGuests.length > 0 && (
                <div className="flex gap-3">
                  <button
                    onClick={selectAllMailable}
                    className="text-sm text-amber-700 hover:underline py-1 px-2 min-h-[36px]"
                  >
                    Select all
                  </button>
                  <button
                    onClick={clearSelection}
                    className="text-sm text-stone-500 hover:underline py-1 px-2 min-h-[36px]"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            {guestsLoading ? (
              <div className="flex items-center gap-2 py-4 text-sm text-stone-500" aria-busy="true">
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                Loading guest list...
              </div>
            ) : guestsError ? (
              <div className="rounded-lg bg-rose-50 border border-rose-200 p-4 text-sm text-rose-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
                <span>
                  Could not load guest list.{' '}
                  <button onClick={() => refetchGuests()} className="underline font-medium">Try again</button>
                </span>
              </div>
            ) : mailableGuests.length === 0 ? (
              <div className="rounded-lg bg-amber-50 border border-amber-100 p-4 text-sm text-amber-800">
                No guests have a mailing address yet.{' '}
                <Link to="/dashboard/guests" className="underline font-medium">Add addresses on the guest list</Link>{' '}
                so they show up here.
              </div>
            ) : (
              <div
                className="max-h-72 overflow-y-auto rounded-lg border border-stone-200 divide-y divide-stone-100"
                role="group"
                aria-labelledby="recipients-label"
              >
                {mailableGuests.map(g => {
                  const checked = selectedIds.includes(g.id)
                  const isInternational = !!g.mailCountry
                  return (
                    <label key={g.id} className="flex items-start gap-3 p-3 cursor-pointer hover:bg-stone-50">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleGuest(g.id)}
                        className="mt-1 w-4 h-4"
                        aria-label={`Select ${g.name}`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-stone-800">
                          {g.name}
                          {isInternational && (
                            <span className="ml-2 text-xs font-normal text-stone-500">International -- not pre-verified</span>
                          )}
                        </p>
                        <p className="text-xs text-stone-500 truncate">
                          {[g.mailLine1, g.mailCity, g.mailState, g.mailZip].filter(Boolean).join(', ')}
                        </p>
                      </div>
                    </label>
                  )
                })}
              </div>
            )}
          </div>

          {/* 4. Return address */}
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2" id="return-address-label">
              4. Return address <span className="font-normal normal-case text-stone-500">(required)</span>
            </p>
            <div className="grid gap-3 sm:grid-cols-2" role="group" aria-labelledby="return-address-label">
              <div className="sm:col-span-2">
                <label htmlFor="returnName" className="sr-only">Name or couple</label>
                <input
                  id="returnName"
                  value={returnName} onChange={e => setReturnName(e.target.value)}
                  placeholder="Name or couple"
                  aria-required="true"
                  className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="returnAddressLine1" className="sr-only">Address line 1</label>
                <input
                  id="returnAddressLine1"
                  value={returnAddressLine1} onChange={e => setReturnAddressLine1(e.target.value)}
                  placeholder="Address line 1"
                  aria-required="true"
                  className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="returnAddressLine2" className="sr-only">Apt / suite (optional)</label>
                <input
                  id="returnAddressLine2"
                  value={returnAddressLine2} onChange={e => setReturnAddressLine2(e.target.value)}
                  placeholder="Apt / suite (optional)"
                  className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="returnCity" className="sr-only">City</label>
                <input
                  id="returnCity"
                  value={returnCity} onChange={e => setReturnCity(e.target.value)}
                  placeholder="City"
                  aria-required="true"
                  className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="returnState" className="sr-only">State (2-letter code)</label>
                  <input
                    id="returnState"
                    value={returnState} onChange={e => setReturnState(e.target.value.toUpperCase())}
                    maxLength={2} placeholder="State"
                    aria-required="true"
                    aria-invalid={stateInvalid}
                    className={`w-full rounded border px-3 py-2 text-sm uppercase ${stateInvalid ? 'border-rose-400 bg-rose-50' : 'border-stone-300'}`}
                  />
                  {stateInvalid && (
                    <p className="text-xs text-rose-600 mt-1">Use 2-letter code (e.g. CA)</p>
                  )}
                </div>
                <div>
                  <label htmlFor="returnZip" className="sr-only">ZIP code</label>
                  <input
                    id="returnZip"
                    value={returnZip} onChange={e => setReturnZip(e.target.value)}
                    placeholder="ZIP"
                    aria-required="true"
                    aria-invalid={zipInvalid}
                    className={`w-full rounded border px-3 py-2 text-sm ${zipInvalid ? 'border-rose-400 bg-rose-50' : 'border-stone-300'}`}
                  />
                  {zipInvalid && (
                    <p className="text-xs text-rose-600 mt-1">Enter a valid 5-digit ZIP</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="pt-4 border-t border-stone-100 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-sm text-stone-600">
                {eligibleSelected.length > 0 ? (
                  <>
                    Estimated: <span className="font-semibold text-stone-900">${estimatedCostDollars.toFixed(2)}</span> ({eligibleSelected.length} postcards)
                    {internationalSelectedCount > 0 && (
                      <span className="block text-xs text-stone-500 mt-0.5">{internationalSelectedCount} international, not pre-verified</span>
                    )}
                  </>
                ) : (
                  <span className="text-stone-500">Pick at least one guest to see cost.</span>
                )}
              </div>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit || createOrder.isPending}
                className="w-full sm:w-auto px-5 py-2.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 min-h-[44px]"
              >
                {createOrder.isPending ? 'Preparing order...' : 'Review & pay'}
              </button>
            </div>
            {!canSubmit && blocker && (
              <p className="text-xs text-stone-500">{blocker}</p>
            )}
          </div>

          {pendingCheckout && (
            <PaymentReviewPanel
              result={pendingCheckout}
              onConfirm={confirmPayment}
              onCancel={cancelPendingCheckout}
            />
          )}

          {/* Always in the DOM so screen readers catch content changes in the live region. */}
          <div role="status" aria-live="polite" className={lastResult ? 'mt-4 p-3 bg-stone-50 rounded-lg text-sm text-stone-700' : 'sr-only'}>
            {lastResult}
          </div>
        </section>

        {/* Past orders */}
        <section aria-labelledby="past-orders-heading">
          <h2 id="past-orders-heading" className="font-serif text-xl font-bold text-brown mb-3">Past print orders</h2>
          {ordersLoading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-stone-500" aria-busy="true">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              Loading orders...
            </div>
          ) : ordersError ? (
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-4 text-sm text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
              <span>
                Could not load past orders.{' '}
                <button onClick={() => refetchOrders()} className="underline font-medium">Try again</button>
              </span>
            </div>
          ) : orders.length === 0 ? (
            <p className="text-sm text-stone-500">No print orders yet.</p>
          ) : (
            <div className="space-y-3">
              {orders.map(o => (
                <PastOrderCard key={o.id} order={o} coupleId={coupleId} guestById={guestById} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

// Issue #59: shown after the order is created (validated + priced) but before any charge or
// mail send, so the couple sees exactly what they're paying for -- and any address that
// couldn't be verified, or duplicate addresses, before committing to Stripe Checkout.
function PaymentReviewPanel({
  result,
  onConfirm,
  onCancel,
}: {
  result: CreatePrintOrderResult
  onConfirm: () => void
  onCancel: () => void
}) {
  const chargeableCount = result.order.recipients.filter(r => r.deliveryStatus === 'PENDING').length
  const chargeDollars = ((result.order.amountChargedCents ?? 0) / 100).toFixed(2)

  return (
    <div className="mt-4 rounded-xl border-2 border-amber-300 bg-amber-50 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-amber-700 mt-0.5 flex-shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-brown">Review before you pay</p>
          <p className="text-sm text-stone-700 mt-1">
            You&apos;ll be charged <span className="font-semibold">${chargeDollars}</span> for{' '}
            <span className="font-semibold">{chargeableCount}</span> postcard{chargeableCount === 1 ? '' : 's'} via Stripe&apos;s secure checkout.
            Nothing is mailed and nothing is charged until you complete payment there.
          </p>

          {result.excludedGuests.length > 0 && (
            <div className="mt-3 rounded-lg bg-white border border-amber-200 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-1.5">
                {result.excludedGuests.length} guest{result.excludedGuests.length === 1 ? '' : 's'} excluded (not charged)
              </p>
              <ul className="text-sm text-stone-600 space-y-1">
                {result.excludedGuests.map(g => (
                  <li key={g.guestId}>
                    <span className="font-medium">{g.guestName ?? 'Guest'}</span>: {g.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.warnings.length > 0 && (
            <div className="mt-3 rounded-lg bg-white border border-amber-200 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-1.5">Heads up</p>
              <ul className="text-sm text-stone-600 space-y-1">
                {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}

          <div className="mt-4 flex flex-col sm:flex-row gap-2">
            <button
              onClick={onConfirm}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 min-h-[44px]"
            >
              Continue to secure payment <ExternalLink className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              onClick={onCancel}
              className="px-5 py-2.5 text-stone-600 text-sm font-medium hover:underline min-h-[44px]"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function PastOrderCard({
  order,
  coupleId,
  guestById,
}: {
  order: PrintOrder
  coupleId: string
  guestById: Map<string, { name: string }>
}) {
  const refresh = useRefreshPrintOrderStatus(coupleId)
  // Only postcards that were actually submitted have a provider id worth tracking.
  const trackable = order.recipients.some(r => r.lobPostcardId)
  const refundedDollars = order.amountRefundedCents ? (order.amountRefundedCents / 100).toFixed(2) : null

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-stone-800">
            {order.orderType === 'SAVE_THE_DATE' ? 'Save the Date' : 'Invitation'} &middot;{' '}
            <span className="text-stone-500 text-sm">
              {TEMPLATE_LABELS[basePrintTemplateKey(order.templateKey) as TemplateKey] ?? order.templateKey}
            </span>
          </p>
          <p className="text-xs text-stone-500 mt-0.5">
            {new Date(order.createdAt).toLocaleString()} &middot; {order.recipientCount} recipients
            {order.amountChargedCents != null && <> &middot; ${(order.amountChargedCents / 100).toFixed(2)} charged</>}
            {refundedDollars && <> &middot; ${refundedDollars} refunded</>}
          </p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {order.errorMessage && (
        <p className="text-xs text-rose-600 mt-2">{order.errorMessage}</p>
      )}

      {order.recipients.length > 0 && (
        <div className="mt-3 border-t border-stone-100 pt-3">
          <div className="flex items-center justify-between mb-2 gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Recipients</p>
            {trackable && (
              <button
                onClick={() => refresh.mutate(order.id)}
                disabled={refresh.isPending}
                className="inline-flex items-center gap-1 text-xs text-amber-700 hover:underline disabled:opacity-50 disabled:no-underline"
              >
                <RefreshCw className={`w-3 h-3 ${refresh.isPending ? 'animate-spin' : ''}`} aria-hidden="true" />
                {refresh.isPending ? 'Checking...' : 'Check delivery status'}
              </button>
            )}
          </div>
          <ul className="divide-y divide-stone-100">
            {order.recipients.map(r => {
              const name = guestById.get(r.guestId)?.name ?? `Guest ${r.guestId.slice(0, 8)}`
              return (
                <li key={r.guestId} className="flex items-start justify-between gap-3 py-1.5 text-sm">
                  <div className="min-w-0">
                    <span className="block truncate text-stone-700">{name}</span>
                    {r.deliveryStatus === 'FAILED' && r.errorMessage && (
                      <span className="text-xs text-rose-600">{r.errorMessage}</span>
                    )}
                    {r.trackingNumber && (
                      <a
                        href={`https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(r.trackingNumber)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-amber-700 hover:underline block"
                      >
                        Track: {r.trackingNumber}
                      </a>
                    )}
                    {r.expectedDeliveryDate && (
                      <span className="text-xs text-stone-500 block">
                        Expected by {new Date(r.expectedDeliveryDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <DeliveryStatusBadge status={r.deliveryStatus} />
                </li>
              )
            })}
          </ul>
          {refresh.isError && (
            <p className="text-xs text-rose-600 mt-2">Could not refresh status. Please try again.</p>
          )}
        </div>
      )}
    </div>
  )
}

// Maps a recipient's delivery status to a friendly label + color. Values are either our own
// submit state (PENDING/SUBMITTED/FAILED) or Lob USPS tracking event names, which match Lob's
// dashboard columns exactly: "Sent" (dispatched, no USPS scan yet), "In Transit",
// "Processed for Delivery", "Delivered", "Re-Routed", "Returned to Sender".
export function deliveryStatusStyle(status: string | null): { label: string; cls: string } {
  const s = (status ?? '').toLowerCase()
  if (s === '' || s === 'submitted') return { label: 'Submitted', cls: 'bg-stone-100 text-stone-600' }
  // Awaiting payment confirmation or the async batch (issue #59/#53) -- not yet sent to Lob.
  if (s === 'pending') return { label: 'Awaiting payment', cls: 'bg-stone-100 text-stone-500' }
  if (s === 'failed') return { label: 'Failed', cls: 'bg-rose-100 text-rose-700' }
  if (s.includes('returned')) return { label: status as string, cls: 'bg-rose-100 text-rose-700' }
  // Exact match only: "Processed for Delivery" / "Out for Delivery" are still in transit, not done.
  if (s === 'delivered') return { label: 'Delivered', cls: 'bg-emerald-100 text-emerald-700' }
  // "Sent" = dispatched to post office, awaiting first USPS scan (Lob dashboard "Total Sent").
  // Keep "mailed" match for any legacy rows written before this rename.
  if (s === 'sent' || s === 'mailed') return { label: 'Sent', cls: 'bg-sky-100 text-sky-700' }
  // In Transit, In Local Area, Processed for Delivery, Re-Routed, etc.
  return { label: status as string, cls: 'bg-amber-100 text-amber-700' }
}

function PostcardPreview({
  templateKey,
  cardSize,
  accent,
  textPosition,
  overlayTheme,
  user,
  heroPhotoUrl,
  websiteLoading,
  weddingUrl,
  scriptureText,
  scriptureReference,
  returnName,
  returnAddressLine1,
  returnAddressLine2,
  returnCity,
  returnState,
  returnZip,
}: {
  templateKey: TemplateKey
  cardSize: CardSize
  accent: string
  textPosition: TextPosition
  overlayTheme: OverlayTextTheme
  user: { partnerOneName: string | null; partnerTwoName: string | null; weddingDate: string | null }
  heroPhotoUrl: string | null
  websiteLoading: boolean
  weddingUrl: string | null
  scriptureText: string | null
  scriptureReference: string | null
  returnName: string
  returnAddressLine1: string
  returnAddressLine2: string
  returnCity: string
  returnState: string
  returnZip: string
}) {
  const [enlarged, setEnlarged] = useState(false)

  const isPhoto = isPhotoTemplate(templateKey)
  const style = styleOf(templateKey)
  const isSaveTheDate = templateKey.startsWith('SAVE_THE_DATE')
  const headline = isSaveTheDate ? 'Save the Date' : "You're Invited"
  // Bride-first (partnerTwoName) to match the printed postcard, the website, and the STD email.
  const names = coupleDisplayName(user.partnerOneName, user.partnerTwoName)
  // formatShortDate gives "Month D, YYYY" (no weekday), matching the printed card's MMMM d, yyyy,
  // and parses YYYY-MM-DD at local noon so it never rolls back a day in negative-UTC timezones.
  const dateLabel = user.weddingDate ? formatShortDate(user.weddingDate) : null
  const hasPhoto = isPhoto && !!heroPhotoUrl
  const qrUrl = weddingUrl ?? 'https://altarwed.com'

  // Shape drives the preview aspect ratio and (for portrait) a stacked layout, mirroring the
  // backend Lob adapter's dimsFor().
  const size = CARD_SIZES.find(s => s.key === cardSize) ?? CARD_SIZES[0]
  const aspect = size.aspect
  const portrait = size.portrait

  // The couple's own verse (matching the printed card); AltarWed default when they haven't set one.
  // Truncate long verses at a word boundary to mirror the backend Lob renderer (MAX_VERSE_CHARS
  // = 120), so the preview shows the same text that will fit the card's fixed-height scrim band.
  const rawVerse = scriptureText?.trim() || DEFAULT_VERSE_TEXT
  const verseBody = rawVerse.length > 120
    ? rawVerse.slice(0, 120).replace(/\s+\S*$/, '').trimEnd() + '…'
    : rawVerse
  const verseRef = (scriptureText?.trim() ? scriptureReference?.trim() : DEFAULT_VERSE_REF) || ''
  const verseLine = `"${verseBody}"${verseRef ? ` - ${verseRef}` : ''}`

  const close = useCallback(() => setEnlarged(false), [])

  function FrontCard({ large }: { large: boolean }) {
    // One scale factor so the small thumbnail and the enlarged modal share one set of sizes.
    const k = large ? 1 : 0.58
    const px = (v: number) => `${Math.round(v * k)}px`
    const namesPx = px(names.length > 22 ? (portrait ? 20 : 22) : (portrait ? 24 : 26))
    const pad = large ? (portrait ? '22px' : '26px') : '13px'
    const frame = {
      width: '100%', aspectRatio: aspect, position: 'relative' as const, borderRadius: '6px',
      overflow: 'hidden', border: '1px solid #e5e0d8', boxSizing: 'border-box' as const,
      fontFamily: 'Georgia, serif',
    }
    if (isPhoto) {
      // Text lives in a scrim band anchored to the couple's chosen 3x3 position (issue #362), so
      // their faces stay clear -- family feedback: "the words aren't over your beautiful faces".
      // The light/dark theme flips the type + scrim for dark vs bright photos; the verse keeps a
      // distinct warm color so it reads as its own line ("a different color for the bible verse").
      const light = overlayTheme !== 'DARK'
      const place = overlayPlacement(textPosition)
      const labelColor = light ? '#f5e9d4' : '#5b4a34'
      const verseColor = light ? '#f0c674' : '#7a531c'
      const textColor = light ? '#fff' : '#2a2018'
      const textShadow = light ? '0 1px 5px rgba(0,0,0,0.6)' : '0 1px 4px rgba(255,255,255,0.6)'
      const scrimStrong = light ? 'rgba(0,0,0,0.82)' : 'rgba(255,255,255,0.85)'
      const scrimFade = light ? 'rgba(0,0,0,0)' : 'rgba(255,255,255,0)'
      const scrimVeil = light ? 'rgba(0,0,0,0.42)' : 'rgba(255,255,255,0.5)'
      const bandH = portrait ? '52%' : '64%'
      // The scrim follows the text: a band on the anchored edge, or a full veil when centered.
      const scrim = place.justifyContent === 'flex-start'
        ? { top: 0, height: bandH, background: `linear-gradient(to bottom, ${scrimStrong}, ${scrimFade})` }
        : place.justifyContent === 'center'
          ? { top: 0, bottom: 0, background: scrimVeil }
          : { bottom: 0, height: bandH, background: `linear-gradient(to top, ${scrimStrong}, ${scrimFade})` }
      return (
        <div style={{ ...frame, background: 'linear-gradient(135deg, #4a3f35, #2a2018)', color: textColor }}>
          {hasPhoto ? (
            <img src={heroPhotoUrl!} alt="" aria-hidden="true"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ position: 'absolute', top: '34%', left: '50%', transform: 'translate(-50%,-50%)', fontSize: px(14), color: 'rgba(255,255,255,0.4)', fontFamily: 'system-ui', whiteSpace: 'nowrap' }}>
              Your couple photo
            </span>
          )}
          <div style={{ position: 'absolute', left: 0, right: 0, ...scrim }} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: place.justifyContent, alignItems: place.alignItems, padding: pad, textAlign: place.textAlign, textShadow }}>
            <div style={{ fontSize: px(11), letterSpacing: '0.3em', textTransform: 'uppercase', color: labelColor, marginBottom: px(6) }}>{headline}</div>
            <div style={{ fontSize: namesPx, fontWeight: 'bold', lineHeight: 1.12 }}>{names}</div>
            {dateLabel && <div style={{ fontSize: px(15), marginTop: px(5), opacity: 0.92 }}>{dateLabel}</div>}
            <div style={{ fontSize: px(10), fontStyle: 'italic', color: verseColor, marginTop: px(7), lineHeight: 1.3 }}>{verseLine}</div>
          </div>
        </div>
      )
    }
    if (style === 'MINIMAL') {
      // Clean white card; the accent is the only color, driving a hairline frame + rule.
      return (
        <div style={{ ...frame, background: '#ffffff', color: '#2b2b2b' }}>
          <div style={{ position: 'absolute', inset: px(14), border: `1px solid ${accent}` }} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: pad, textAlign: 'center' }}>
            <div style={{ fontSize: px(11), letterSpacing: '0.45em', textTransform: 'uppercase', color: accent, marginBottom: px(10) }}>{headline}</div>
            <div style={{ fontSize: namesPx, lineHeight: 1.15, letterSpacing: '0.02em' }}>{names}</div>
            <div style={{ width: px(50), height: '1px', background: accent, margin: `${px(9)} 0` }} />
            {dateLabel && <div style={{ fontSize: px(12), letterSpacing: '0.18em', textTransform: 'uppercase', color: '#555' }}>{dateLabel}</div>}
          </div>
          <div style={{ position: 'absolute', bottom: px(13), left: 0, right: 0, textAlign: 'center', fontSize: px(9), fontStyle: 'italic', color: '#8a6a4a', padding: '0 8%' }}>{verseLine}</div>
        </div>
      )
    }
    if (style === 'BOTANICAL') {
      // Warm ivory with a double accent frame + an accent sprig standing in for a botanical wreath.
      return (
        <div style={{ ...frame, background: '#f7f3ea', color: '#33413a' }}>
          <div style={{ position: 'absolute', inset: px(12), border: `2px solid ${accent}` }} />
          <div style={{ position: 'absolute', inset: px(17), border: `1px solid ${accent}`, opacity: 0.55 }} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: pad, textAlign: 'center' }}>
            <div style={{ fontSize: px(11), letterSpacing: '0.4em', textTransform: 'uppercase', color: accent, marginBottom: px(8) }}>{headline}</div>
            <div style={{ fontSize: namesPx, fontWeight: 'bold', lineHeight: 1.12 }}>{names}</div>
            <div style={{ color: accent, fontSize: px(13), letterSpacing: '0.3em', margin: `${px(6)} 0 ${px(3)}` }} aria-hidden="true">&middot; &#10047; &middot;</div>
            {dateLabel && <div style={{ fontSize: px(14), color: '#4a5a4a' }}>{dateLabel}</div>}
          </div>
          <div style={{ position: 'absolute', bottom: px(13), left: 0, right: 0, textAlign: 'center', fontSize: px(10), fontStyle: 'italic', color: '#5a7a55', padding: '0 8%' }}>{verseLine}</div>
        </div>
      )
    }
    if (style === 'DARK_ELEGANT') {
      // Deep charcoal card with light cream type; the accent is the eyebrow + divider.
      return (
        <div style={{ ...frame, background: 'linear-gradient(150deg, #241f1b, #12100e)', color: '#f3ece0' }}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: pad, textAlign: 'center' }}>
            <div style={{ fontSize: px(11), letterSpacing: '0.46em', textTransform: 'uppercase', color: accent, marginBottom: px(8) }}>{headline}</div>
            <div style={{ fontSize: namesPx, fontWeight: 'bold', lineHeight: 1.12 }}>{names}</div>
            <div style={{ width: px(60), height: '2px', background: accent, margin: `${px(8)} 0` }} />
            {dateLabel && <div style={{ fontSize: px(15), color: '#d8ccb8' }}>{dateLabel}</div>}
          </div>
          <div style={{ position: 'absolute', bottom: px(13), left: 0, right: 0, textAlign: 'center', fontSize: px(10), fontStyle: 'italic', color: '#d9b877', padding: '0 8%' }}>{verseLine}</div>
        </div>
      )
    }
    // Classic: centered cream + gold; the accent carries the eyebrow label + a rule under the names.
    return (
      <div style={{ ...frame, background: 'linear-gradient(135deg, #fdfaf6, #f5e9d4)', color: '#3b2f2f' }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: pad, textAlign: 'center' }}>
          <div style={{ fontSize: px(12), letterSpacing: '0.32em', textTransform: 'uppercase', color: accent, marginBottom: px(8) }}>{headline}</div>
          <div style={{ fontSize: namesPx, fontWeight: 'bold', lineHeight: 1.12 }}>{names}</div>
          <div style={{ width: px(64), height: '2px', background: accent, margin: `${px(7)} 0 0` }} />
          {dateLabel && <div style={{ fontSize: px(16), marginTop: px(8), color: '#6a5a45' }}>{dateLabel}</div>}
        </div>
        <div style={{ position: 'absolute', bottom: px(13), left: 0, right: 0, textAlign: 'center', fontSize: px(10), fontStyle: 'italic', color: '#9c7434', padding: '0 8%' }}>{verseLine}</div>
      </div>
    )
  }

  function BackCard({ large }: { large: boolean }) {
    const fs = large
      ? { label: '10px', names: names.length > 24 ? '15px' : '18px', date: '11px', body: '9px', bodySmall: '8px', meta: '7px', qrLabel: '7px' }
      : { label: '6px',  names: names.length > 24 ? '9px' : '11px',  date: '7px',  body: '5.5px', bodySmall: '5px', meta: '4.5px', qrLabel: '4.5px' }
    const qrSize = large ? 68 : 30
    const pad = large ? '18px 18px 18px 20px' : '10px 10px 10px 12px'
    const stampW = large ? 30 : 18
    const stampH = large ? 36 : 22
    const hasReturnAddress = !!(returnName.trim() && returnAddressLine1.trim() && returnCity.trim())

    // Message content (couple's own verse; distinct gold so it stands out), reused in both the
    // landscape (left column) and portrait (top band) layouts.
    const messageContent = (
      <>
        <div style={{ fontSize: fs.label, letterSpacing: '0.3em', textTransform: 'uppercase', color: accent }}>{headline}</div>
        <div style={{ fontSize: fs.names, fontWeight: 'bold', lineHeight: 1.2 }}>{names}</div>
        {dateLabel && <div style={{ fontSize: fs.date, color: '#8a6a4a', marginTop: '1px' }}>{dateLabel}</div>}
        <div style={{ fontSize: fs.body, color: '#8a6a4a', marginTop: large ? '7px' : '4px' }}>
          {isSaveTheDate ? 'Formal invitation to follow' : 'Please join us as we celebrate our marriage ceremony'}
        </div>
        {/* The verse prints on the FRONT of the card, not the back (see the Lob back templates,
            which render no scripture). Keep it off the back preview so the preview matches the
            mailed card. */}
        <div style={{ marginTop: large ? '9px' : '5px' }}>
          <QRCodeCanvas value={qrUrl} size={qrSize} fgColor="#3b2f2f" bgColor="#fdfaf6" level="M" />
          <div style={{ fontSize: fs.qrLabel, color: accent, marginTop: large ? '4px' : '2px' }}>Scan to visit our site</div>
        </div>
      </>
    )

    // Mailing side: return address, stamp box, and the recipient address lines Lob prints.
    const mailingContent = (
      <>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: large ? '8px' : '4px' }}>
          <div style={{ fontSize: fs.meta, color: hasReturnAddress ? '#5a4a3a' : '#a08060', lineHeight: 1.6, fontFamily: 'system-ui', opacity: hasReturnAddress ? 1 : 0.6 }}>
            {hasReturnAddress ? (
              <>
                <div>{returnName.trim()}</div>
                <div>{returnAddressLine1.trim()}{returnAddressLine2.trim() ? `, ${returnAddressLine2.trim()}` : ''}</div>
                <div>{returnCity.trim()}, {returnState.trim() || 'ST'} {returnZip.trim() || '00000'}</div>
              </>
            ) : (
              <>
                <div>Your Name</div>
                <div>Your Address</div>
                <div>City, ST 00000</div>
              </>
            )}
          </div>
          <div style={{ width: `${stampW}px`, height: `${stampH}px`, border: '1px solid #d0c8b8', borderRadius: '1px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: large ? '5px' : '3px', color: '#d0c8b8', fontFamily: 'system-ui', textAlign: 'center' }}>STAMP</span>
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: large ? '12px' : '7px', paddingTop: '2px' }}>
          {[0, 1, 2].map(i => <div key={i} style={{ borderBottom: '0.5px solid #d0c8b8' }} />)}
        </div>
      </>
    )

    const frameBase = {
      width: '100%', aspectRatio: aspect, position: 'relative' as const, borderRadius: '6px',
      overflow: 'hidden', border: '1px solid #e5e0d8', boxSizing: 'border-box' as const,
      background: '#fdfaf6', display: 'flex', fontFamily: 'Georgia, serif', color: '#3b2f2f',
    }

    // Portrait cards address on the BOTTOM (message band on top); landscape addresses on the
    // RIGHT (message column on the left). Mirrors the backend renderPortraitBack/renderLandscapeBack.
    if (portrait) {
      return (
        <div style={{ ...frameBase, flexDirection: 'column' }}>
          <div style={{ padding: pad, borderBottom: '1px solid #e5e0d8', display: 'flex', flexDirection: 'column', gap: large ? '4px' : '2px' }}>{messageContent}</div>
          <div style={{ flex: 1, padding: large ? '14px' : '9px', display: 'flex', flexDirection: 'column' }}>{mailingContent}</div>
        </div>
      )
    }
    return (
      <div style={{ ...frameBase, flexDirection: 'row' }}>
        <div style={{ flex: '0 0 54%', padding: pad, borderRight: '1px solid #e5e0d8', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: large ? '4px' : '2px' }}>{messageContent}</div>
        <div style={{ flex: 1, padding: large ? '12px' : '8px', display: 'flex', flexDirection: 'column' }}>{mailingContent}</div>
      </div>
    )
  }

  return (
    <>
      <div className="mt-4">
        <p className="text-xs text-stone-500 mb-2 uppercase tracking-wide font-medium">
          Preview <span className="normal-case font-normal">(click to enlarge)</span>
        </p>
        <button
          className="w-full text-left cursor-zoom-in"
          onClick={() => setEnlarged(true)}
          aria-label="Enlarge postcard preview"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-stone-500 mb-1.5 font-medium">Front</p>
              <FrontCard large={false} />
            </div>
            <div>
              <p className="text-xs text-stone-500 mb-1.5 font-medium">Back</p>
              <BackCard large={false} />
            </div>
          </div>
        </button>
        {isPhoto && !websiteLoading && !heroPhotoUrl && (
          <p className="text-xs text-stone-500 mt-1.5">
            Upload a couple photo on your wedding website to see it here.
          </p>
        )}
      </div>

      <AnimatePresence>
        {enlarged && (
          <AnimatedModal
            onClose={close}
            containerClassName="items-center justify-center p-4 sm:p-8"
            backdropClassName="bg-black/70"
            ariaLabel="Postcard preview enlarged"
            panelClassName="z-10 w-full max-w-[min(90vw,880px)]"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-white">Postcard preview</p>
              <button
                onClick={close}
                className="text-white/70 hover:text-white text-sm underline"
                aria-label="Close preview"
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-white/60 mb-1.5 uppercase tracking-wide font-medium">Front</p>
                <FrontCard large={true} />
              </div>
              <div>
                <p className="text-xs text-white/60 mb-1.5 uppercase tracking-wide font-medium">Back</p>
                <BackCard large={true} />
              </div>
            </div>
          </AnimatedModal>
        )}
      </AnimatePresence>
    </>
  )
}

function DeliveryStatusBadge({ status }: { status: string | null }) {
  const { label, cls } = deliveryStatusStyle(status)
  return (
    <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded ${cls}`}>{label}</span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    DRAFT: 'bg-stone-100 text-stone-700',
    PENDING_PAYMENT: 'bg-stone-100 text-stone-500',
    PROCESSING: 'bg-sky-100 text-sky-700',
    SUBMITTED: 'bg-emerald-100 text-emerald-700',
    PARTIAL_FAILURE: 'bg-amber-100 text-amber-700',
    FAILED: 'bg-rose-100 text-rose-700',
    MAILED: 'bg-sky-100 text-sky-700',
  }
  const labels: Record<string, string> = {
    PENDING_PAYMENT: 'Awaiting payment',
    PROCESSING: 'Submitting',
    PARTIAL_FAILURE: 'Partial failure',
  }
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded ${styles[status] ?? 'bg-stone-100 text-stone-700'}`}>
      {labels[status] ?? status.replace('_', ' ')}
    </span>
  )
}
