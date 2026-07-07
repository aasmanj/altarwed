import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { fireConfetti } from '@/lib/fireConfetti'
import { useQuery } from '@tanstack/react-query'
import {
  Camera, Landmark, Flower2, UtensilsCrossed, CakeSlice, Music, Scissors,
  Video, ClipboardList, Church, Car, Mail, Shirt, Sparkles, PartyPopper, MessageCircle,
} from 'lucide-react'
import { useAuth } from '@/core/auth/AuthContext'
import { apiClient } from '@/core/api/client'
import { useCreateCheckoutSession } from './useSubscription'
import type { SubscriptionInfo } from './useSubscription'
import PromoCodeBox from './PromoCodeBox'

const CATEGORIES = [
  { value: 'PHOTOGRAPHER',    label: 'Photographer',          icon: Camera },
  { value: 'VENUE',           label: 'Venue',                 icon: Landmark },
  { value: 'FLORIST',         label: 'Florist',               icon: Flower2 },
  { value: 'CATERER',         label: 'Caterer',               icon: UtensilsCrossed },
  { value: 'CAKE',            label: 'Cake',                  icon: CakeSlice },
  { value: 'MUSIC',           label: 'Music',                 icon: Music },
  { value: 'HAIR_AND_MAKEUP', label: 'Hair & Makeup',         icon: Scissors },
  { value: 'VIDEOGRAPHER',    label: 'Videographer',          icon: Video },
  { value: 'COORDINATOR',     label: 'Coordinator',           icon: ClipboardList },
  { value: 'COUNSELING',      label: 'Pre-Marital Counseling', icon: MessageCircle },
  { value: 'OFFICIANT',       label: 'Officiant',             icon: Church },
  { value: 'TRANSPORTATION',  label: 'Transportation',        icon: Car },
  { value: 'INVITATION',      label: 'Invitations',           icon: Mail },
  { value: 'ALTERATIONS',     label: 'Alterations',           icon: Shirt },
  { value: 'OTHER',           label: 'Other',                 icon: Sparkles },
]

const STEP_LABELS = ['Category', 'Details', 'Account', 'Get listed']
const TOTAL_STEPS = 4

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 64 : -64, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -64 : 64, opacity: 0 }),
}

const slideTransition = { duration: 0.22, ease: [0.4, 0, 0.2, 1] as const }

const inputCls =
  'w-full rounded-lg border border-[#e8dcc8] px-4 py-2.5 text-[#3b2f2f] text-sm focus:border-[#d4af6a] focus:outline-none focus:ring-1 focus:ring-[#d4af6a]'
const labelCls = 'block text-sm font-medium text-[#3b2f2f] mb-1'

export default function RegisterVendorPage() {
  const { registerVendor } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const [registered, setRegistered] = useState(false)

  const [category, setCategory] = useState('')
  const [isChristianOwned, setIsChristianOwned] = useState(false)
  const [businessName, setBusinessName] = useState('')
  const [city, setCity] = useState('')
  const [vendorState, setVendorState] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const { data: sub, isLoading: subLoading, isError: subError, refetch: refetchSub } = useQuery<SubscriptionInfo>({
    queryKey: ['vendor', 'subscription'],
    queryFn: () => apiClient.get('/api/v1/vendors/me/subscription').then(r => r.data),
    enabled: registered,
    retry: 2,
  })

  const checkout = useCreateCheckoutSession()

  function advance() {
    setDir(1)
    setStep(s => s + 1)
  }

  function back() {
    setError('')
    setDir(-1)
    setStep(s => s - 1)
  }

  async function handleRegister() {
    if (password !== confirmPassword) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setSubmitting(true)
    setError('')
    try {
      await registerVendor({
        businessName, category, city, state: vendorState, email, password, isChristianOwned,
      })
      setRegistered(true)
      fireConfetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#d4af6a', '#fff', '#3b2f2f', '#f0e8d8'] })
      setTimeout(() => fireConfetti({ particleCount: 50, spread: 110, origin: { y: 0.5 }, angle: 60,  colors: ['#d4af6a', '#f0e8d8'] }), 250)
      setTimeout(() => fireConfetti({ particleCount: 50, spread: 110, origin: { y: 0.5 }, angle: 120, colors: ['#3b2f2f', '#d4af6a'] }), 400)
      advance()
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(detail ?? 'Registration failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#fdfaf6] flex flex-col">
      <header className="px-6 py-4 flex items-center justify-between border-b border-[#e8dcc8] bg-white">
        <span className="font-serif text-xl font-bold text-[#3b2f2f]">AltarWed</span>
        <Link to="/login" className="text-sm text-[#8a6a4a] hover:text-[#3b2f2f] transition">
          Have an account? Sign in
        </Link>
      </header>

      <div className="px-4 pt-5 pb-2 max-w-lg mx-auto w-full">
        <div className="flex gap-1.5">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                i <= step ? 'bg-[#d4af6a]' : 'bg-[#e8dcc8]'
              }`}
            />
          ))}
        </div>
        <p className="text-xs text-[#8a6a4a] mt-2">
          Step {step + 1} of {TOTAL_STEPS}: {STEP_LABELS[step]}
        </p>
      </div>

      <div className="flex-1 flex items-start justify-center px-4 pt-2 pb-16 overflow-hidden">
        <div className="w-full max-w-lg">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={step}
              custom={dir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={slideTransition}
            >
              {step === 0 && (
                <CategoryStep
                  category={category}
                  onSelectCategory={setCategory}
                  isChristianOwned={isChristianOwned}
                  onToggleChristian={() => setIsChristianOwned(v => !v)}
                  onNext={() => { if (category) advance() }}
                />
              )}
              {step === 1 && (
                <DetailsStep
                  businessName={businessName}
                  setBusinessName={setBusinessName}
                  city={city}
                  setCity={setCity}
                  state={vendorState}
                  setState={setVendorState}
                  onBack={back}
                  onNext={() => {
                    if (businessName.trim() && city.trim() && vendorState.trim()) advance()
                  }}
                />
              )}
              {step === 2 && (
                <AccountStep
                  email={email}
                  setEmail={setEmail}
                  password={password}
                  setPassword={setPassword}
                  confirmPassword={confirmPassword}
                  setConfirmPassword={setConfirmPassword}
                  error={error}
                  submitting={submitting}
                  onBack={back}
                  onSubmit={handleRegister}
                />
              )}
              {step === 3 && (
                <StripeStep
                  sub={sub ?? null}
                  subLoading={subLoading}
                  subError={subError}
                  onRetry={refetchSub}
                  checkoutPending={checkout.isPending}
                  onCheckout={priceId => checkout.mutate(priceId)}
                  onRedeemed={() => navigate('/vendor')}
                  onSkip={() => navigate('/vendor')}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step components
// ---------------------------------------------------------------------------

function CategoryStep({
  category,
  onSelectCategory,
  isChristianOwned,
  onToggleChristian,
  onNext,
}: {
  category: string
  onSelectCategory: (v: string) => void
  isChristianOwned: boolean
  onToggleChristian: () => void
  onNext: () => void
}) {
  return (
    <div className="space-y-5 pt-4">
      <div>
        <h1 className="font-serif text-2xl font-bold text-[#3b2f2f]">What type of business are you?</h1>
        <p className="text-sm text-[#8a6a4a] mt-1">Choose the category that best describes your services.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {CATEGORIES.map(cat => {
          const Icon = cat.icon
          return (
            <button
              key={cat.value}
              type="button"
              onClick={() => onSelectCategory(cat.value)}
              className={`rounded-xl border p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af6a] ${
                category === cat.value
                  ? 'border-[#d4af6a] bg-[#fdf6eb] shadow-sm'
                  : 'border-[#e8dcc8] bg-white hover:border-[#d4af6a]/50 hover:bg-[#fdf6eb]/40'
              }`}
            >
              <Icon className="w-5 h-5 mb-1.5 text-[#8a6a4a]" aria-hidden="true" />
              <span className="text-xs font-medium text-[#3b2f2f] leading-tight">{cat.label}</span>
            </button>
          )
        })}
      </div>

      <label htmlFor="wiz-christianOwned" className="flex items-center gap-3 cursor-pointer rounded-xl border border-[#e8dcc8] bg-white p-4 hover:border-[#d4af6a]/50 transition">
        <input
          id="wiz-christianOwned"
          type="checkbox"
          checked={isChristianOwned}
          onChange={onToggleChristian}
          className="h-4 w-4 rounded border-[#e8dcc8] accent-[#d4af6a] shrink-0"
        />
        <span className="flex flex-col">
          <span className="text-sm font-medium text-[#3b2f2f]">This is a Christian-owned business</span>
          <span className="text-xs text-[#8a6a4a]">Shows a badge on your listing</span>
        </span>
      </label>

      <button
        type="button"
        onClick={onNext}
        disabled={!category}
        className="w-full rounded-xl bg-[#3b2f2f] py-3 font-semibold text-white hover:bg-[#5c4033] disabled:opacity-40 transition"
      >
        Continue
      </button>

      <p className="text-center text-sm text-[#8a6a4a]">
        Planning a wedding?{' '}
        <Link to="/register" className="text-[#3b2f2f] font-medium hover:underline">Sign up as a couple</Link>
      </p>
    </div>
  )
}

function DetailsStep({
  businessName, setBusinessName,
  city, setCity,
  state, setState,
  onBack, onNext,
}: {
  businessName: string; setBusinessName: (v: string) => void
  city: string; setCity: (v: string) => void
  state: string; setState: (v: string) => void
  onBack: () => void; onNext: () => void
}) {
  const canContinue = businessName.trim() && city.trim() && state.trim()
  return (
    <div className="space-y-5 pt-4">
      <div>
        <h1 className="font-serif text-2xl font-bold text-[#3b2f2f]">Tell us about your business</h1>
        <p className="text-sm text-[#8a6a4a] mt-1">This is what couples see when they find your listing.</p>
      </div>

      <div className="bg-white rounded-2xl border border-[#e8dcc8] p-6 space-y-4">
        <div>
          <label htmlFor="wiz-businessName" className={labelCls}>Business name *</label>
          <input
            id="wiz-businessName"
            value={businessName}
            onChange={e => setBusinessName(e.target.value)}
            className={inputCls}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="wiz-city" className={labelCls}>City *</label>
            <input
              id="wiz-city"
              value={city}
              onChange={e => setCity(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="wiz-state" className={labelCls}>State *</label>
            <input
              id="wiz-state"
              value={state}
              onChange={e => setState(e.target.value)}
              className={inputCls}
              maxLength={50}
            />
            <p className="text-xs text-[#8a6a4a] mt-1">2-letter abbreviation</p>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 rounded-xl border border-[#e8dcc8] py-3 text-sm font-semibold text-[#3b2f2f] hover:bg-[#f5ede0] transition"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!canContinue}
          className="flex-1 rounded-xl bg-[#3b2f2f] py-3 font-semibold text-white hover:bg-[#5c4033] disabled:opacity-40 transition"
        >
          Continue
        </button>
      </div>
    </div>
  )
}

function AccountStep({
  email, setEmail,
  password, setPassword,
  confirmPassword, setConfirmPassword,
  error, submitting, onBack, onSubmit,
}: {
  email: string; setEmail: (v: string) => void
  password: string; setPassword: (v: string) => void
  confirmPassword: string; setConfirmPassword: (v: string) => void
  error: string; submitting: boolean
  onBack: () => void; onSubmit: () => void
}) {
  const canSubmit =
    email.trim() && password.length >= 8 && password === confirmPassword && !submitting
  return (
    <div className="space-y-5 pt-4">
      <div>
        <h1 className="font-serif text-2xl font-bold text-[#3b2f2f]">Create your account</h1>
        <p className="text-sm text-[#8a6a4a] mt-1">This is how you'll log in to manage your listing.</p>
      </div>

      <div className="bg-white rounded-2xl border border-[#e8dcc8] p-6 space-y-4">
        <div>
          <label htmlFor="wiz-email" className={labelCls}>Email *</label>
          <input
            id="wiz-email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className={inputCls}
            autoComplete="email"
          />
        </div>
        <div>
          <label htmlFor="wiz-password" className={labelCls}>Password *</label>
          <input
            id="wiz-password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className={inputCls}
            autoComplete="new-password"
          />
          <p className="text-xs text-[#8a6a4a] mt-1">At least 8 characters</p>
        </div>
        <div>
          <label htmlFor="wiz-confirmPassword" className={labelCls}>Confirm password *</label>
          <input
            id="wiz-confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            className={inputCls}
            autoComplete="new-password"
          />
        </div>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      </div>

      {/* Sign-in-wrap acceptance directly above the action button (issue #219).
          Vendors upload no guest data, so the couple guest clause is dropped.
          text-[#6b5344] on the #fdfaf6 page is above WCAG AA 4.5:1. */}
      <p className="text-xs text-[#6b5344] leading-snug">
        By creating an account you agree to our{' '}
        <a
          href="https://www.altarwed.com/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#3b2f2f] font-medium underline hover:text-[#5c4033]"
        >
          Terms of Service
        </a>{' '}
        and{' '}
        <a
          href="https://www.altarwed.com/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#3b2f2f] font-medium underline hover:text-[#5c4033]"
        >
          Privacy Policy
        </a>
        .
      </p>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="flex-1 rounded-xl border border-[#e8dcc8] py-3 text-sm font-semibold text-[#3b2f2f] hover:bg-[#f5ede0] disabled:opacity-40 transition"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className="flex-1 rounded-xl bg-[#3b2f2f] py-3 font-semibold text-white hover:bg-[#5c4033] disabled:opacity-40 transition"
        >
          {submitting ? 'Creating account...' : 'Create my account'}
        </button>
      </div>
    </div>
  )
}

function StripeStep({
  sub, subLoading, subError, onRetry, checkoutPending, onCheckout, onRedeemed, onSkip,
}: {
  sub: SubscriptionInfo | null
  subLoading: boolean
  subError: boolean
  onRetry: () => void
  checkoutPending: boolean
  onCheckout: (priceId: string) => void
  onRedeemed: () => void
  onSkip: () => void
}) {
  return (
    <div className="space-y-5 pt-4">
      <div className="text-center py-3">
        <PartyPopper className="w-10 h-10 mx-auto mb-3 text-[#d4af6a]" aria-hidden="true" />
        <h1 className="font-serif text-2xl font-bold text-[#3b2f2f]">Your account is ready!</h1>
        <p className="text-sm text-[#8a6a4a] mt-1">
          Subscribe to publish your listing and start reaching couples.
        </p>
      </div>

      {subError ? (
        <div className="rounded-2xl border border-[#e8dcc8] bg-white p-8 text-center">
          <p className="text-sm text-[#6b5344] mb-3">Could not load pricing. Check your connection and try again.</p>
          <button
            type="button"
            onClick={onRetry}
            className="text-sm font-medium text-[#d4af6a] hover:text-[#b8964e] transition"
          >
            Retry
          </button>
        </div>
      ) : subLoading ? (
        <div className="rounded-2xl border border-[#e8dcc8] bg-white p-8 text-center">
          <p className="text-sm text-[#8a6a4a] animate-pulse">Loading pricing...</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-[#e8dcc8] bg-white divide-y divide-[#e8dcc8]">
          <StripeRow
            label="Monthly"
            price="$29 / month"
            description="Billed monthly, cancel anytime"
            ariaLabel="Subscribe monthly for $29 per month"
            priceId={sub?.proMonthlyPriceId ?? null}
            onCheckout={onCheckout}
            loading={checkoutPending}
          />
          <StripeRow
            label="Annual"
            price="$290 / year"
            description="Save 2 months vs. monthly"
            badge="Best value"
            ariaLabel="Subscribe annually for $290 per year"
            priceId={sub?.proAnnualPriceId ?? null}
            onCheckout={onCheckout}
            loading={checkoutPending}
          />
        </div>
      )}

      <div className="rounded-xl bg-[#fdf6eb] border border-[#e8dcc8] p-4">
        <p className="text-xs font-semibold text-[#3b2f2f] mb-1.5">What you get with a subscription</p>
        <ul className="text-xs text-[#6b5344] space-y-1 list-disc list-inside">
          <li>Your listing published in the AltarWed directory</li>
          <li>Priority placement in category and city search</li>
          <li>Profile views and inquiry analytics</li>
          <li>Featured badge visible to browsing couples</li>
        </ul>
      </div>

      <PromoCodeBox onRedeemed={onRedeemed} />

      <button
        type="button"
        onClick={onSkip}
        className="w-full text-sm text-[#8a6a4a] hover:text-[#3b2f2f] transition py-2 underline underline-offset-2"
      >
        Skip for now (listing stays unpublished until you subscribe)
      </button>
    </div>
  )
}

function StripeRow({
  label, price, description, badge, ariaLabel, priceId, onCheckout, loading,
}: {
  label: string
  price: string
  description: string
  badge?: string
  ariaLabel: string
  priceId: string | null
  onCheckout: (priceId: string) => void
  loading: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-5">
      <div>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-[#3b2f2f]">{label}</span>
          {badge && (
            <span className="text-xs font-medium text-[#d4af6a] bg-[#d4af6a]/10 px-2 py-0.5 rounded-full">
              {badge}
            </span>
          )}
        </div>
        <p className="text-lg font-bold text-[#3b2f2f] mt-0.5">{price}</p>
        <p className="text-xs text-[#8a6a4a]">{description}</p>
      </div>
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => priceId && onCheckout(priceId)}
        disabled={loading || !priceId}
        className="shrink-0 rounded-lg bg-[#3b2f2f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5c4033] transition disabled:opacity-40"
      >
        {loading ? 'Loading...' : 'Subscribe'}
      </button>
    </div>
  )
}
