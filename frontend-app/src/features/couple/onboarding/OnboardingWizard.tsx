import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useQuery, useMutation } from '@tanstack/react-query'
import { ImagePlus, Loader2, MapPin, Hotel as HotelIcon, Sparkles, BookOpen, Gift, Check } from 'lucide-react'
import { useAuth } from '@/core/auth/AuthContext'
import { apiClient } from '@/core/api/client'
import { useCreateWeddingWebsite, useUpdateWeddingWebsite } from '@/features/couple/website/useWeddingWebsite'
import { formatShortDate } from '@/lib/date'
import { normalizeImageFile, isAllowedImageType } from '@/lib/normalizeImageFile'
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL, uploadErrorMessage } from '@/lib/upload'
import ImageDropzone from '@/components/ImageDropzone'
import { readPersistedState, writePersistedState, clearPersistentState } from '@/lib/usePersistentState'
import {
  trackOnboardingStepViewed,
  trackOnboardingSkipped,
  trackOnboardingCompleted,
} from '@/features/couple/onboarding/onboardingAnalytics'

// Wizard collects everything required to render a presentable rough draft of
// the wedding site in one sitting. Steps after #2 are all optional so couples
// who just want a placeholder can skip through, but the order matches the
// natural conversation: names → URL/date → where & when → guest logistics
// (hotel) → look & feel (hero, scripture) → registry → confirm. Persisting
// happens once at the end in handleFinish so a couple can drop out partway
// without orphaning rows.

const TOTAL_STEPS = 8
type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

const inputCls = 'w-full rounded-lg border border-[#e8dcc8] px-4 py-3 text-[#3b2f2f] text-sm focus:border-[#d4af6a] focus:outline-none focus:ring-1 focus:ring-[#d4af6a]'

// Curated default hero photos hosted on Azure Blob (altarwed-media/defaults/hero/).
// Same set the side-by-side editor offers so the wizard and editor stay consistent.
const HERO_BASE = 'https://altarwedprodstorage.blob.core.windows.net/altarwed-media/defaults/hero'
const DEFAULT_HERO_PHOTOS = [
  `${HERO_BASE}/altar-couple.jpg`,
  `${HERO_BASE}/church-arch.jpg`,
  `${HERO_BASE}/garden-vows.jpg`,
  `${HERO_BASE}/sunset-walk.jpg`,
  `${HERO_BASE}/ring-exchange.jpg`,
  `${HERO_BASE}/chapel-door.jpg`,
]

// Common registries couples link. Tapping one fills the label so a non-technical
// user isn't staring at a blank "Registry name" field wondering what to type.
const REGISTRY_SUGGESTIONS = ['Amazon', 'Target', 'Zola', 'Crate & Barrel', 'Honeyfund']

// Persist the wizard's text fields so a mid-flow refresh doesn't reset progress.
// sessionStorage (clears on tab close) is the right lifetime; the 30-minute idle
// TTL also discards an abandoned draft on a shared device. The uploaded hero File
// can't be serialized and is intentionally not persisted. Storage is handled by
// the shared sessionStorage primitives so the format/TTL match RegisterPage.
const ONBOARDING_KEY = 'altarwed.onboarding'
const ONBOARDING_TTL_MS = 30 * 60 * 1000

// Optional fields collected across steps 3-7. Kept as a plain string bag so the
// payload builder below stays a pure function (no React state) and can be unit
// tested: the "Skip the rest" shortcut must save exactly what clicking through
// and skipping every step would save, and this is the one place that decides it.
export interface OptionalWebsiteInput {
  venueName: string; venueAddress: string; venueCity: string; venueState: string; ceremonyTime: string
  hotelName: string; hotelUrl: string; hotelDetails: string
  scriptureReference: string; scriptureText: string
  registryUrl1: string; registryLabel1: string
  heroPhotoUrl: string | null
}

// Build the PATCH payload for the optional steps. A field is only sent when the
// couple actually entered it, so a skipped step contributes nothing. This is
// what makes the finish shortcut behavior-neutral: whether you tap through the
// per-step "Skip for now" buttons or jump straight to creation, the empty
// fields produce the same (absent) defaults here.
export function buildOptionalWebsiteFields(i: OptionalWebsiteInput): Record<string, string | null> {
  const optional: Record<string, string | null> = {}
  if (i.venueName.trim())         optional.venueName          = i.venueName.trim()
  if (i.venueAddress.trim())      optional.venueAddress       = i.venueAddress.trim()
  if (i.venueCity.trim())         optional.venueCity          = i.venueCity.trim()
  if (i.venueState.trim())        optional.venueState         = i.venueState.trim()
  if (i.ceremonyTime.trim())      optional.ceremonyTime       = i.ceremonyTime.trim()
  if (i.hotelName.trim())         optional.hotelName          = i.hotelName.trim()
  if (i.hotelUrl.trim())          optional.hotelUrl           = i.hotelUrl.trim()
  if (i.hotelDetails.trim())      optional.hotelDetails       = i.hotelDetails.trim()
  if (i.scriptureReference)       optional.scriptureReference = i.scriptureReference
  if (i.scriptureText)            optional.scriptureText      = i.scriptureText
  if (i.registryUrl1.trim())      optional.registryUrl1       = i.registryUrl1.trim()
  if (i.registryLabel1.trim())    optional.registryLabel1     = i.registryLabel1.trim()
  // Default-photo URL goes through PATCH; file uploads go through the dedicated
  // /uploads endpoint after the site exists.
  if (i.heroPhotoUrl)             optional.heroPhotoUrl       = i.heroPhotoUrl
  return optional
}

// The "Skip the rest, create my site now" shortcut is offered once the required
// slug step (2) is reached and up to, but not including, the final confirm step
// (which already has its own "Create my site" button). Only steps 1-2 are
// required, so from step 2 the remaining steps are all optional and skippable
// in a single tap.
export function shouldShowFinishShortcut(step: number): boolean {
  return step >= 2 && step < TOTAL_STEPS
}

interface FeaturedRefs { references: string[] }
interface VerseResult  { reference: string; text: string }

function useScriptureFeatured() {
  return useQuery<FeaturedRefs>({
    queryKey: ['scripture-featured'],
    queryFn: () => apiClient.get('/api/v1/scripture/featured').then(r => r.data),
    staleTime: Infinity,
  })
}

function useScriptureFetch() {
  return useMutation<VerseResult, Error, string>({
    mutationFn: (q: string) =>
      apiClient.get(`/api/v1/scripture/search?q=${encodeURIComponent(q)}`).then(r => r.data),
  })
}

export default function OnboardingWizard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const coupleId = user?.id ?? ''
  const createWebsite = useCreateWeddingWebsite(coupleId)
  const updateWebsite = useUpdateWeddingWebsite(coupleId)

  const draft = useMemo(
    () => readPersistedState<Record<string, string>>(ONBOARDING_KEY, {}, ONBOARDING_TTL_MS),
    [],
  )

  const [step, setStep] = useState<Step>(() => {
    const s = Number(draft.step)
    return (s >= 1 && s <= TOTAL_STEPS ? s : 1) as Step
  })
  const directionRef = useRef(1)
  const shouldReduce = useReducedMotion()
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Required (steps 1-2)
  const [partnerOneName, setPartnerOneName] = useState(user?.partnerOneName ?? draft.partnerOneName ?? '')
  const [partnerTwoName, setPartnerTwoName] = useState(user?.partnerTwoName ?? draft.partnerTwoName ?? '')
  const [slug, setSlug] = useState(draft.slug ?? '')
  const [weddingDate, setWeddingDate] = useState(user?.weddingDate ?? draft.weddingDate ?? '')
  const dateLocked = !!user?.weddingDate

  // Optional (steps 3-7), all skippable
  const [venueName, setVenueName] = useState(draft.venueName ?? '')
  const [venueAddress, setVenueAddress] = useState(draft.venueAddress ?? '')
  const [venueCity, setVenueCity] = useState(draft.venueCity ?? '')
  const [venueState, setVenueState] = useState(draft.venueState ?? '')
  const [ceremonyTime, setCeremonyTime] = useState(draft.ceremonyTime ?? '')

  const [hotelName, setHotelName] = useState(draft.hotelName ?? '')
  const [hotelUrl, setHotelUrl] = useState(draft.hotelUrl ?? '')
  const [hotelDetails, setHotelDetails] = useState(draft.hotelDetails ?? '')

  // Hero: either a picked default URL OR a File the user uploaded. Only the
  // picked-URL persists; an uploaded File can't be serialized to sessionStorage.
  const [heroPhotoUrl, setHeroPhotoUrl] = useState<string | null>(draft.heroPhotoUrl || null)
  const [heroFile, setHeroFile] = useState<File | null>(null)
  const [heroFilePreview, setHeroFilePreview] = useState<string | null>(null)
  const [heroError, setHeroError] = useState<string | null>(null)

  // Scripture: reference + text fetched from bible-api.com via our proxy.
  const [scriptureReference, setScriptureReference] = useState(draft.scriptureReference ?? '')
  const [scriptureText, setScriptureText] = useState(draft.scriptureText ?? '')
  const featured = useScriptureFeatured()
  const fetchVerse = useScriptureFetch()

  const [registryUrl1, setRegistryUrl1] = useState(draft.registryUrl1 ?? '')
  const [registryLabel1, setRegistryLabel1] = useState(draft.registryLabel1 ?? '')

  // Persist the draft on every change so a refresh keeps the couple's progress.
  useEffect(() => {
    const snapshot = {
      step: String(step),
      partnerOneName, partnerTwoName, slug, weddingDate,
      venueName, venueAddress, venueCity, venueState, ceremonyTime,
      hotelName, hotelUrl, hotelDetails,
      heroPhotoUrl: heroPhotoUrl ?? '',
      scriptureReference, scriptureText,
      registryUrl1, registryLabel1,
    }
    writePersistedState(ONBOARDING_KEY, snapshot)
  }, [step, partnerOneName, partnerTwoName, slug, weddingDate,
      venueName, venueAddress, venueCity, venueState, ceremonyTime,
      hotelName, hotelUrl, hotelDetails, heroPhotoUrl,
      scriptureReference, scriptureText, registryUrl1, registryLabel1])

  // Emit one analytics event per step VIEW (issue #239). Keyed on step only, so
  // it fires on mount (step 1, or the persisted step after a refresh) and again
  // on every forward/back transition, but a re-render from a field change does
  // not re-run it and cannot double-fire. Only the step index and a static slug
  // leave the browser; no couple-entered value is attached.
  useEffect(() => {
    trackOnboardingStepViewed(step)
  }, [step])

  const suggestSlug = () => {
    if (partnerOneName && partnerTwoName) {
      const raw = `${partnerTwoName}-and-${partnerOneName}`
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
      setSlug(raw)
    }
  }

  const handleHeroFile = async (picked: File) => {
    // Convert HEIC (iPhone / Google Photos) to JPEG before validating, so the
    // backend's jpeg/png/webp whitelist accepts it. Surface a clear message on
    // failure instead of silently dropping the file (the couple picked a photo
    // and nothing appearing, with no reason, was a real onboarding dead end).
    setHeroError(null)
    const file = await normalizeImageFile(picked)
    if (!isAllowedImageType(file)) {
      setHeroError('That image type is not supported. Please use a JPEG, PNG, or WebP (or an iPhone HEIC photo).')
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setHeroError(`That photo is over ${MAX_UPLOAD_LABEL}. Please choose a smaller image.`)
      return
    }
    setHeroFile(file)
    setHeroFilePreview(URL.createObjectURL(file))
    setHeroPhotoUrl(null)
  }

  const pickFeaturedVerse = async (reference: string) => {
    if (scriptureReference === reference) {
      // Tap again to deselect
      setScriptureReference('')
      setScriptureText('')
      return
    }
    try {
      const verse = await fetchVerse.mutateAsync(reference)
      setScriptureReference(verse.reference)
      setScriptureText(verse.text)
    } catch {
      // Silent on wizard, couple can pin later from /dashboard/scripture
    }
  }

  const goto = (n: Step) => { setError(''); setStep(n) }
  const next = () => { directionRef.current = 1; goto(Math.min(step + 1, TOTAL_STEPS) as Step) }
  const back = () => { directionRef.current = -1; goto(Math.max(step - 1, 1) as Step) }

  const handleFinish = async () => {
    if (!slug.trim()) { setError('URL slug is required.'); goto(2); return }
    setSubmitting(true)
    setError('')
    try {
      // 1. Create the website with the required fields. Backend assigns an id
      //    and seeds the couple-owned rows.
      const created = await createWebsite.mutateAsync({
        slug: slug.trim(),
        partnerOneName: partnerOneName.trim(),
        partnerTwoName: partnerTwoName.trim(),
        weddingDate: weddingDate || undefined,
      })

      // 2. PATCH the optional fields in one round-trip. Only entered fields are
      //    sent, so a step the couple skipped (whether per-step or via the
      //    finish shortcut) contributes nothing. Built by a shared pure helper
      //    so both paths save identical data.
      const optional = buildOptionalWebsiteFields({
        venueName, venueAddress, venueCity, venueState, ceremonyTime,
        hotelName, hotelUrl, hotelDetails,
        scriptureReference, scriptureText,
        registryUrl1, registryLabel1,
        heroPhotoUrl,
      })

      if (Object.keys(optional).length > 0) {
        await updateWebsite.mutateAsync(optional)
      }

      // Completion moment (issue #239): the site row now exists. This is the
      // distinct funnel-close before website_published (which fires later, in
      // the editor), and it is fired here so both exit paths below (successful
      // hero upload and the hero-upload-failed fallback, where the site is still
      // created) already count as completed. No PII in the payload.
      trackOnboardingCompleted()

      // 3. Hero file upload. Has to happen AFTER website creation because
      //    the endpoint is keyed by websiteId. If it fails, site is still
      //    created -- send the couple to the editor with an actionable notice.
      if (heroFile) {
        try {
          const form = new FormData()
          form.append('file', heroFile)
          await apiClient.post(
            `/api/v1/uploads/wedding-websites/${created.id}/hero`,
            form,
            { headers: { 'Content-Type': 'multipart/form-data' } },
          )
        } catch (uploadErr: unknown) {
          // The site is created either way; surface the backend's real
          // rejection detail (size / type / dimensions on a 413/415/400) so the
          // couple knows what to fix instead of guessing, and reassure them the
          // photo can still be added from the editor.
          const reason = uploadErrorMessage(uploadErr, 'The hero photo failed to upload.')
          const notice = `Your site was created, but the hero photo could not be added: ${reason} You can add or replace it from the editor.`
          clearPersistentState(ONBOARDING_KEY)
          navigate('/dashboard/website/editor', { state: { notice } })
          return
        }
      }

      // Website created: clear the persisted wizard draft.
      clearPersistentState(ONBOARDING_KEY)
      navigate('/dashboard/website/editor')
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(detail ?? 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // The "Skip the rest, create my site now" shortcut. Records where the couple
  // jumped out of the guided flow (issue #239) before reusing the shared
  // handleFinish, so the skip event and the completion event are both attributed
  // to the same run. Keeping this a thin wrapper preserves the behavior-neutral
  // guarantee that the shortcut and the tap-through path save identical data.
  const handleSkipFinish = () => {
    trackOnboardingSkipped(step)
    void handleFinish()
  }

  return (
    <div className="min-h-screen bg-[#fdfaf6] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">

        {/* Visually-hidden page title so the heading outline has a top level
            (step headings start at h2). One h1 per page. */}
        <h1 className="sr-only">Wedding Setup</h1>

        {/* Progress */}
        <div className="mb-8 text-center">
          <p className="text-xs uppercase tracking-widest text-[#8a6a4a] mb-2">
            Step {step} of {TOTAL_STEPS}
          </p>
          <div className="h-1.5 w-full max-w-xs mx-auto rounded-full bg-[#e8dcc8] overflow-hidden">
            <div
              className="h-full bg-[#d4af6a] transition-all duration-500"
              style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#e8dcc8] shadow-sm overflow-hidden">
          <AnimatePresence mode="wait" initial={false} custom={directionRef.current}>
            <motion.div
              key={step}
              custom={directionRef.current}
              variants={{
                enter: (d: number) => ({ x: d * 40, opacity: 0 }),
                center: { x: 0, opacity: 1 },
                exit: (d: number) => ({ x: d * -40, opacity: 0 }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={shouldReduce ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 30 }}
              className="p-8"
            >
              {step === 1 && (
                <Step1Names
                  partnerOneName={partnerOneName}
                  partnerTwoName={partnerTwoName}
                  onPartnerOne={setPartnerOneName}
                  onPartnerTwo={setPartnerTwoName}
                  onNext={() => { suggestSlug(); next() }}
                />
              )}

              {step === 2 && (
                <Step2UrlDate
                  slug={slug}
                  onSlug={setSlug}
                  weddingDate={weddingDate}
                  onWeddingDate={setWeddingDate}
                  dateLocked={dateLocked}
                  onBack={back}
                  onNext={next}
                />
              )}

              {step === 3 && (
                <Step3Venue
                  venueName={venueName} onVenueName={setVenueName}
                  venueAddress={venueAddress} onVenueAddress={setVenueAddress}
                  venueCity={venueCity} onVenueCity={setVenueCity}
                  venueState={venueState} onVenueState={setVenueState}
                  ceremonyTime={ceremonyTime} onCeremonyTime={setCeremonyTime}
                  onBack={back} onNext={next}
                />
              )}

              {step === 4 && (
                <Step4Hotel
                  hotelName={hotelName} onHotelName={setHotelName}
                  hotelUrl={hotelUrl} onHotelUrl={setHotelUrl}
                  hotelDetails={hotelDetails} onHotelDetails={setHotelDetails}
                  onBack={back} onNext={next}
                />
              )}

              {step === 5 && (
                <Step5Hero
                  heroPhotoUrl={heroPhotoUrl}
                  onPickDefault={url => { setHeroPhotoUrl(url); setHeroFile(null); setHeroFilePreview(null); setHeroError(null) }}
                  heroFilePreview={heroFilePreview}
                  onPickFile={handleHeroFile}
                  heroError={heroError}
                  onBack={back} onNext={next}
                />
              )}

              {step === 6 && (
                <Step6Scripture
                  featured={featured.data?.references ?? []}
                  isLoadingFeatured={featured.isLoading}
                  selectedReference={scriptureReference}
                  selectedText={scriptureText}
                  isFetching={fetchVerse.isPending}
                  onPick={pickFeaturedVerse}
                  onBack={back} onNext={next}
                />
              )}

              {step === 7 && (
                <Step7Registry
                  registryUrl={registryUrl1} onRegistryUrl={setRegistryUrl1}
                  registryLabel={registryLabel1} onRegistryLabel={setRegistryLabel1}
                  onBack={back} onNext={next}
                />
              )}

              {step === 8 && (
                <Step8Confirm
                  bride={partnerTwoName} groom={partnerOneName}
                  slug={slug} weddingDate={weddingDate}
                  filledChecklist={{
                    venue:     !!venueName,
                    hotel:     !!hotelName,
                    hero:      !!(heroPhotoUrl || heroFile),
                    scripture: !!scriptureReference,
                    registry:  !!registryUrl1,
                  }}
                  error={error}
                  submitting={submitting}
                  onBack={back}
                  onFinish={handleFinish}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Bottom hint */}
        <p className="text-center text-xs text-[#8a6a4a] mt-6">
          You can change everything later in the side-by-side editor.
        </p>

        {/* Finish shortcut. Only steps 1-2 are required, so from step 2 onward a
            couple (often a paid-ad arrival) can create the site in one tap
            instead of skipping through five optional steps. Reuses handleFinish,
            so it saves exactly what tapping "Skip for now" on each step would.
            Disabled until a slug exists, since the URL is required. */}
        {shouldShowFinishShortcut(step) && (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={handleSkipFinish}
              disabled={submitting || !slug.trim()}
              className="text-sm font-medium text-[#8a6a4a] underline underline-offset-2 hover:text-[#3b2f2f] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#d4af6a] rounded disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed"
            >
              {submitting ? 'Creating your site…' : 'Skip the rest, create my site now'}
            </button>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Step components ─────────────────────────────────────────────────────────

function Step1Names({
  partnerOneName, partnerTwoName, onPartnerOne, onPartnerTwo, onNext,
}: {
  partnerOneName: string; partnerTwoName: string
  onPartnerOne: (v: string) => void; onPartnerTwo: (v: string) => void
  onNext: () => void
}) {
  return (
    <div className="space-y-6">
      <Header
        title="Welcome to AltarWed"
        subtitle="Let's build your wedding website. First, whose names should be on it?"
      />
      <LabeledInput label="Bride" value={partnerTwoName} onChange={onPartnerTwo} />
      <LabeledInput label="Groom" value={partnerOneName} onChange={onPartnerOne} />
      <PrimaryButton onClick={onNext} disabled={!partnerOneName.trim() || !partnerTwoName.trim()}>
        Continue →
      </PrimaryButton>
    </div>
  )
}

function useSlugAvailability(slug: string) {
  const [debouncedSlug, setDebouncedSlug] = useState(slug)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSlug(slug), 400)
    return () => clearTimeout(t)
  }, [slug])

  return useQuery<unknown, { response?: { status?: number } }>({
    queryKey: ['slug-check', debouncedSlug],
    queryFn: () => apiClient.get(`/api/v1/wedding-websites/slug/${encodeURIComponent(debouncedSlug)}`),
    enabled: debouncedSlug.length >= 3,
    retry: false,
    staleTime: 30_000,
  })
}

function Step2UrlDate({
  slug, onSlug, weddingDate, onWeddingDate, dateLocked, onBack, onNext,
}: {
  slug: string; onSlug: (v: string) => void
  weddingDate: string; onWeddingDate: (v: string) => void
  dateLocked: boolean
  onBack: () => void; onNext: () => void
}) {
  const { isFetching, isSuccess, isError, error } = useSlugAvailability(slug)
  const isTaken = isSuccess // 200 = slug exists = taken
  const isAvailable = isError && (error as { response?: { status?: number } })?.response?.status === 404
  const showStatus = slug.length >= 3

  return (
    <div className="space-y-6">
      <Header title="Your wedding URL" subtitle="This is the link you'll share with guests" />
      <div>
        <label className="block text-sm font-medium text-[#3b2f2f] mb-1">Website URL</label>
        <div className={`flex items-center rounded-lg border overflow-hidden focus-within:ring-1 ${isTaken ? 'border-rose-400 focus-within:ring-rose-400' : isAvailable ? 'border-emerald-400 focus-within:ring-emerald-400' : 'border-[#e8dcc8] focus-within:border-[#d4af6a] focus-within:ring-[#d4af6a]'}`}>
          <span className="px-3 py-3 bg-[#f5ede0] text-[#8a6a4a] text-sm whitespace-nowrap border-r border-[#e8dcc8]">
            altarwed.com/wedding/
          </span>
          <input
            value={slug}
            onChange={e => onSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
            className="flex-1 px-3 py-3 text-sm text-[#3b2f2f] focus:outline-none bg-white"
            aria-describedby="slug-status"
          />
          {showStatus && (
            <span className="px-3 shrink-0">
              {isFetching
                ? <Loader2 className="w-4 h-4 animate-spin text-[#8a6a4a]" />
                : isAvailable
                ? <Check className="w-4 h-4 text-emerald-500" />
                : isTaken
                ? <span className="text-rose-500 text-xs font-medium">Taken</span>
                : null}
            </span>
          )}
        </div>
        <p id="slug-status" className={`text-xs mt-1 ${isTaken ? 'text-rose-600' : isAvailable ? 'text-emerald-600' : 'text-[#8a6a4a]'}`}>
          {isTaken
            ? 'That URL is already taken. Try adding your wedding date or location.'
            : isAvailable
            ? 'That URL is available!'
            : 'Lowercase letters, numbers, and hyphens only'}
        </p>
      </div>
      {!dateLocked && (
        <div>
          <label className="block text-sm font-medium text-[#3b2f2f] mb-1">
            Wedding date <span className="text-[#8a6a4a] font-normal">(optional)</span>
          </label>
          <input type="date" value={weddingDate} onChange={e => onWeddingDate(e.target.value)} className={inputCls} />
          {weddingDate && weddingDate < new Date().toISOString().slice(0, 10) && (
            <p className="mt-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              This date has already passed. If you're documenting a past ceremony, that's fine!
            </p>
          )}
        </div>
      )}
      {dateLocked && weddingDate && (
        <div className="rounded-lg bg-[#fdfaf6] border border-[#e8dcc8] px-4 py-3 text-sm text-[#8a6a4a]">
          Wedding date: <span className="text-[#3b2f2f] font-medium">{formatShortDate(weddingDate)}</span>
          <span className="block text-xs mt-0.5">You can change this any time in your dashboard.</span>
        </div>
      )}
      <Nav onBack={onBack} onNext={onNext} disableNext={!slug.trim() || isTaken} />
    </div>
  )
}

function Step3Venue({
  venueName, onVenueName, venueAddress, onVenueAddress,
  venueCity, onVenueCity, venueState, onVenueState,
  ceremonyTime, onCeremonyTime, onBack, onNext,
}: {
  venueName: string; onVenueName: (v: string) => void
  venueAddress: string; onVenueAddress: (v: string) => void
  venueCity: string; onVenueCity: (v: string) => void
  venueState: string; onVenueState: (v: string) => void
  ceremonyTime: string; onCeremonyTime: (v: string) => void
  onBack: () => void; onNext: () => void
}) {
  return (
    <div className="space-y-5">
      <Header
        icon={<MapPin className="w-5 h-5 text-[#d4af6a]" />}
        title="Where & when"
        subtitle="The ceremony venue. You can skip and add this later."
      />
      <LabeledInput label="Venue name" value={venueName} onChange={onVenueName} />
      <LabeledInput label="Street address" value={venueAddress} onChange={onVenueAddress} />
      <div className="grid grid-cols-2 gap-3">
        <LabeledInput label="City" value={venueCity} onChange={onVenueCity} />
        <LabeledInput label="State" value={venueState} onChange={onVenueState} />
      </div>
      <LabeledInput
        label="Ceremony time"
        value={ceremonyTime}
        onChange={onCeremonyTime}
        hint="Free-form, whatever you'd write on the invitation."
      />
      <Nav onBack={onBack} onNext={onNext} nextLabel={venueName ? 'Continue →' : 'Skip for now →'} />
    </div>
  )
}

function Step4Hotel({
  hotelName, onHotelName, hotelUrl, onHotelUrl, hotelDetails, onHotelDetails, onBack, onNext,
}: {
  hotelName: string; onHotelName: (v: string) => void
  hotelUrl: string; onHotelUrl: (v: string) => void
  hotelDetails: string; onHotelDetails: (v: string) => void
  onBack: () => void; onNext: () => void
}) {
  return (
    <div className="space-y-5">
      <Header
        icon={<HotelIcon className="w-5 h-5 text-[#d4af6a]" />}
        title="Hotel for guests"
        subtitle="Got a room block negotiated? Drop it here. You can add more hotels later."
      />
      <LabeledInput label="Hotel name" value={hotelName} onChange={onHotelName} />
      <LabeledInput label="Booking URL" value={hotelUrl} onChange={onHotelUrl} />
      <div>
        <label className="block text-sm font-medium text-[#3b2f2f] mb-1">Notes for guests</label>
        <textarea
          value={hotelDetails}
          onChange={e => onHotelDetails(e.target.value)}
          rows={3}
          className={inputCls}
        />
      </div>
      <Nav onBack={onBack} onNext={onNext} nextLabel={hotelName ? 'Continue →' : 'Skip for now →'} />
    </div>
  )
}

function Step5Hero({
  heroPhotoUrl, onPickDefault, heroFilePreview, onPickFile, heroError, onBack, onNext,
}: {
  heroPhotoUrl: string | null; onPickDefault: (url: string) => void
  heroFilePreview: string | null; onPickFile: (file: File) => void
  heroError: string | null
  onBack: () => void; onNext: () => void
}) {
  const picked = heroFilePreview ?? heroPhotoUrl
  return (
    <div className="space-y-5">
      <Header
        icon={<ImagePlus className="w-5 h-5 text-[#d4af6a]" />}
        title="Hero photo"
        subtitle="The big image at the top of your site. Pick one of ours or upload your own."
      />

      {picked && (
        <div className="rounded-xl overflow-hidden border-2 border-[#d4af6a] shadow-sm">
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <img src={picked} alt="Selected hero" className="w-full h-40 object-cover" />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-[#3b2f2f] mb-2">Pick a default</label>
        <div className="grid grid-cols-3 gap-2">
          {DEFAULT_HERO_PHOTOS.map(url => {
            // Derive a readable name from the filename (e.g. "altar-couple.jpg"
            // becomes "altar couple") so a screen reader announces distinct
            // buttons instead of six identical empty ones.
            const name = url.split('/').pop()?.replace(/\.[^.]+$/, '').replace(/-/g, ' ') ?? 'photo'
            const selected = heroPhotoUrl === url
            return (
            <button
              key={url}
              type="button"
              onClick={() => onPickDefault(url)}
              aria-label={`Use default hero photo: ${name}`}
              aria-pressed={selected}
              className={`relative aspect-[3/2] rounded-lg overflow-hidden border-2 transition ${
                selected ? 'border-[#d4af6a] ring-2 ring-[#d4af6a]' : 'border-transparent hover:border-[#e8dcc8]'
              }`}
            >
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <img src={url} alt="" className="w-full h-full object-cover" />
              {selected && (
                <span className="absolute inset-0 bg-black/30 flex items-center justify-center">
                  <Check className="w-6 h-6 text-white" />
                </span>
              )}
            </button>
            )
          })}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-[#3b2f2f] mb-2">Or upload your own</label>
        <ImageDropzone
          onPick={onPickFile}
          ariaLabel="Upload a hero photo"
          className="block w-full rounded-lg border-2 border-dashed border-[#e8dcc8] hover:border-[#d4af6a] transition"
        >
          <span className="block w-full text-center py-4 text-sm text-[#8a6a4a]">
            <ImagePlus className="inline-block w-4 h-4 mr-1" />
            Drag a photo here, or click to choose (JPEG, PNG, WebP, HEIC up to {MAX_UPLOAD_LABEL})
          </span>
        </ImageDropzone>
        {heroError && (
          <p role="alert" className="mt-2 text-xs text-red-600 leading-snug">
            {heroError}
          </p>
        )}
        <p className="mt-2 text-xs text-[#8a6a4a] leading-snug">
          A wide landscape photo works best. Tall portrait shots get cropped top and bottom in the banner.
        </p>
      </div>

      <Nav onBack={onBack} onNext={onNext} nextLabel={picked ? 'Continue →' : 'Skip for now →'} />
    </div>
  )
}

function Step6Scripture({
  featured, isLoadingFeatured, selectedReference, selectedText, isFetching, onPick, onBack, onNext,
}: {
  featured: string[]; isLoadingFeatured: boolean
  selectedReference: string; selectedText: string; isFetching: boolean
  onPick: (ref: string) => void
  onBack: () => void; onNext: () => void
}) {
  return (
    <div className="space-y-5">
      <Header
        icon={<BookOpen className="w-5 h-5 text-[#d4af6a]" />}
        title="A scripture for your wedding"
        subtitle="Featured verses couples love. Tap one to pin it to your site, or skip and pick later."
      />

      {selectedText && (
        <div className="rounded-xl bg-[#fdfaf6] border border-[#d4af6a] px-4 py-3">
          <p className="font-serif italic text-[#3b2f2f] text-sm leading-relaxed">&ldquo;{selectedText}&rdquo;</p>
          <p className="mt-2 text-xs text-[#8a6a4a] uppercase tracking-wider">{selectedReference}</p>
        </div>
      )}

      {isLoadingFeatured && <p className="text-sm text-[#8a6a4a]">Loading…</p>}

      {!isLoadingFeatured && featured.length > 0 && (
        <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
          {featured.map(ref => {
            const isPicked = selectedReference === ref
            return (
              <button
                key={ref}
                type="button"
                onClick={() => onPick(ref)}
                disabled={isFetching}
                className={`text-left px-3 py-2 text-xs rounded-md border transition ${
                  isPicked
                    ? 'bg-[#3b2f2f] text-white border-[#3b2f2f]'
                    : 'bg-white text-[#3b2f2f] border-[#e8dcc8] hover:border-[#d4af6a]'
                } disabled:opacity-60`}
              >
                {ref}
              </button>
            )
          })}
        </div>
      )}

      {isFetching && (
        <p className="text-xs text-[#8a6a4a] flex items-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin" /> Fetching verse…
        </p>
      )}

      <Nav onBack={onBack} onNext={onNext} nextLabel={selectedReference ? 'Continue →' : 'Skip for now →'} />
    </div>
  )
}

function Step7Registry({
  registryUrl, onRegistryUrl, registryLabel, onRegistryLabel, onBack, onNext,
}: {
  registryUrl: string; onRegistryUrl: (v: string) => void
  registryLabel: string; onRegistryLabel: (v: string) => void
  onBack: () => void; onNext: () => void
}) {
  return (
    <div className="space-y-5">
      <Header
        icon={<Gift className="w-5 h-5 text-[#d4af6a]" />}
        title="Registry"
        subtitle="One link to start. You can add up to two more in the editor."
      />
      <div>
        <LabeledInput label="Registry name" value={registryLabel} onChange={onRegistryLabel} />
        <div className="flex flex-wrap gap-1.5 mt-2">
          {REGISTRY_SUGGESTIONS.map(name => (
            <button
              key={name}
              type="button"
              onClick={() => onRegistryLabel(name)}
              className={`rounded-full border px-2.5 py-1 text-xs transition ${
                registryLabel === name
                  ? 'border-[#d4af6a] bg-[#d4af6a] text-white'
                  : 'border-[#e8dcc8] text-[#8a6a4a] hover:border-[#d4af6a] hover:text-[#3b2f2f]'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      </div>
      <LabeledInput label="Link" value={registryUrl} onChange={onRegistryUrl} />
      <Nav onBack={onBack} onNext={onNext} nextLabel={registryUrl ? 'Continue →' : 'Skip for now →'} />
    </div>
  )
}

function Step8Confirm({
  bride, groom, slug, weddingDate, filledChecklist, error, submitting, onBack, onFinish,
}: {
  bride: string; groom: string; slug: string; weddingDate: string
  filledChecklist: Record<'venue' | 'hotel' | 'hero' | 'scripture' | 'registry', boolean>
  error: string; submitting: boolean
  onBack: () => void; onFinish: () => void
}) {
  const items: Array<[keyof typeof filledChecklist, string]> = [
    ['venue',     'Ceremony venue'],
    ['hotel',     'Hotel block'],
    ['hero',      'Hero photo'],
    ['scripture', 'Scripture verse'],
    ['registry',  'Registry'],
  ]
  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <Sparkles className="w-10 h-10 text-[#d4af6a] mx-auto mb-3" />
        <h2 className="font-serif text-2xl font-bold text-[#3b2f2f] mb-1">Ready to launch</h2>
        <p className="text-sm text-[#8a6a4a]">We&apos;ll build your draft site with what you gave us.</p>
      </div>

      <div className="rounded-xl bg-[#fdfaf6] border border-[#e8dcc8] p-5 space-y-3">
        <Row label="Couple" value={`${bride} & ${groom}`} />
        <Row label="URL" value={`altarwed.com/wedding/${slug}`} />
        {weddingDate && <Row label="Date" value={formatShortDate(weddingDate)} />}
      </div>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-widest text-[#8a6a4a]">Site content</p>
        {items.map(([key, label]) => (
          <div key={key} className="flex items-center gap-2 text-sm">
            <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
              filledChecklist[key] ? 'bg-[#d4af6a] text-white' : 'bg-[#e8dcc8] text-[#8a6a4a]'
            }`}>
              {filledChecklist[key] ? <Check className="w-3 h-3" /> : null}
            </span>
            <span className={filledChecklist[key] ? 'text-[#3b2f2f]' : 'text-[#8a6a4a]'}>
              {label}{filledChecklist[key] ? '' : ' (add later)'}
            </span>
          </div>
        ))}
      </div>

      <p className="text-xs text-center text-[#8a6a4a]">
        Your site starts as a draft. Publish it when you&apos;re ready for guests to see it.
      </p>

      {error && <p className="text-sm text-red-600 text-center">{error}</p>}

      <div className="flex gap-3">
        <button
          onClick={onBack}
          disabled={submitting}
          className="flex-1 rounded-xl border border-[#e8dcc8] py-3 font-semibold text-[#3b2f2f] hover:bg-[#fdfaf6] transition text-sm disabled:opacity-50"
        >
          ← Back
        </button>
        <button
          onClick={onFinish}
          disabled={submitting}
          className="flex-1 rounded-xl bg-[#d4af6a] py-3 font-semibold text-white hover:bg-[#b8923e] disabled:opacity-60 transition flex items-center justify-center gap-2"
        >
          {submitting
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</>
            : <>Create my site</>
          }
        </button>
      </div>
    </div>
  )
}

// ── Shared bits ─────────────────────────────────────────────────────────────

function Header({ icon, title, subtitle }: { icon?: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="text-center mb-2">
      {icon && <div className="flex justify-center mb-3">{icon}</div>}
      <h2 className="font-serif text-2xl font-bold text-[#3b2f2f] mb-1">{title}</h2>
      <p className="text-sm text-[#8a6a4a]">{subtitle}</p>
    </div>
  )
}

// useId + htmlFor instead of label-wraps-input so jsx-a11y stops flagging
// these as unlabelled controls (it doesn't reliably detect implicit nesting).
function LabeledInput({
  label, value, onChange, placeholder, hint,
}: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; hint?: string
}) {
  const id = useIdSafe()
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-[#3b2f2f] mb-1">{label}</label>
      <input id={id} value={value} onChange={e => onChange(e.target.value)} className={inputCls} placeholder={placeholder} />
      {hint && <p className="text-xs text-[#8a6a4a] mt-1">{hint}</p>}
    </div>
  )
}

// Local wrapper around React.useId so we don't have to add it to every import.
function useIdSafe(): string {
  return useId()
}

function PrimaryButton({ onClick, disabled, children }: {
  onClick: () => void; disabled?: boolean; children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-xl bg-[#3b2f2f] py-3 font-semibold text-white hover:bg-[#5c4033] disabled:opacity-50 transition"
    >
      {children}
    </button>
  )
}

function Nav({ onBack, onNext, disableNext, nextLabel = 'Continue →' }: {
  onBack: () => void; onNext: () => void; disableNext?: boolean; nextLabel?: string
}) {
  return (
    <div className="flex gap-3 pt-2">
      <button
        onClick={onBack}
        className="flex-1 rounded-xl border border-[#e8dcc8] py-3 font-semibold text-[#3b2f2f] hover:bg-[#fdfaf6] transition text-sm"
      >
        ← Back
      </button>
      <button
        onClick={onNext}
        disabled={disableNext}
        className="flex-1 rounded-xl bg-[#3b2f2f] py-3 font-semibold text-white hover:bg-[#5c4033] disabled:opacity-50 transition"
      >
        {nextLabel}
      </button>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-sm text-[#8a6a4a] shrink-0">{label}</span>
      <span className="text-sm font-medium text-[#3b2f2f] text-right">{value}</span>
    </div>
  )
}
