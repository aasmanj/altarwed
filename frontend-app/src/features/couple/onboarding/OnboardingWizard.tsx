import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/core/auth/AuthContext'
import { useCreateWeddingWebsite } from '@/features/couple/website/useWeddingWebsite'

type Step = 1 | 2 | 3

const inputCls = 'w-full rounded-lg border border-[#e8dcc8] px-4 py-3 text-[#3b2f2f] text-sm focus:border-[#d4af6a] focus:outline-none focus:ring-1 focus:ring-[#d4af6a]'

export default function OnboardingWizard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const createWebsite = useCreateWeddingWebsite(user?.id ?? '')

  const [step, setStep] = useState<Step>(1)
  const [slug, setSlug] = useState('')
  const [partnerOneName, setPartnerOneName] = useState(user?.partnerOneName ?? '')
  const [partnerTwoName, setPartnerTwoName] = useState(user?.partnerTwoName ?? '')
  const [weddingDate, setWeddingDate] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Auto-generate slug from partner names
  const suggestSlug = () => {
    if (partnerOneName && partnerTwoName) {
      const raw = `${partnerOneName}-and-${partnerTwoName}`
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
      setSlug(raw)
    }
  }

  const handleFinish = async () => {
    if (!slug.trim()) { setError('Please enter a URL slug'); return }
    setSubmitting(true)
    setError('')
    try {
      await createWebsite.mutateAsync({
        slug: slug.trim(),
        partnerOneName: partnerOneName.trim(),
        partnerTwoName: partnerTwoName.trim(),
        weddingDate: weddingDate || undefined,
      })
      navigate('/dashboard/website')
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(detail ?? 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#fdfaf6] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg">

        {/* Progress */}
        <div className="flex items-center gap-2 mb-10 justify-center">
          {([1, 2, 3] as Step[]).map(n => (
            <div key={n} className="flex items-center gap-2">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold transition ${
                n < step ? 'bg-[#d4af6a] text-white'
                : n === step ? 'bg-[#3b2f2f] text-white'
                : 'bg-[#e8dcc8] text-[#a08060]'
              }`}>
                {n < step ? '✓' : n}
              </div>
              {n < 3 && <div className={`h-px w-8 ${n < step ? 'bg-[#d4af6a]' : 'bg-[#e8dcc8]'}`} />}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-[#e8dcc8] p-8 shadow-sm">

          {/* Step 1 — Names */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h1 className="font-serif text-2xl font-bold text-[#3b2f2f] mb-1">Welcome to AltarWed</h1>
                <p className="text-sm text-[#a08060]">Let&apos;s build your wedding website. First, whose names should be on it?</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#3b2f2f] mb-1">Groom / Partner 1</label>
                <input value={partnerOneName} onChange={e => setPartnerOneName(e.target.value)}
                  className={inputCls} placeholder="Jordan" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#3b2f2f] mb-1">Bride / Partner 2</label>
                <input value={partnerTwoName} onChange={e => setPartnerTwoName(e.target.value)}
                  className={inputCls} placeholder="Eden-Faith" />
              </div>
              <button
                onClick={() => { suggestSlug(); setStep(2) }}
                disabled={!partnerOneName.trim() || !partnerTwoName.trim()}
                className="w-full rounded-xl bg-[#3b2f2f] py-3 font-semibold text-white hover:bg-[#5c4033] disabled:opacity-50 transition"
              >
                Continue →
              </button>
            </div>
          )}

          {/* Step 2 — URL & date */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h2 className="font-serif text-2xl font-bold text-[#3b2f2f] mb-1">Your wedding URL</h2>
                <p className="text-sm text-[#a08060]">This is the link you&apos;ll share with guests</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#3b2f2f] mb-1">Website URL</label>
                <div className="flex items-center gap-0 rounded-lg border border-[#e8dcc8] overflow-hidden focus-within:border-[#d4af6a] focus-within:ring-1 focus-within:ring-[#d4af6a]">
                  <span className="px-3 py-3 bg-[#f5ede0] text-[#a08060] text-sm whitespace-nowrap border-r border-[#e8dcc8]">
                    altarwed.com/wedding/
                  </span>
                  <input
                    value={slug}
                    onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                    className="flex-1 px-3 py-3 text-sm text-[#3b2f2f] focus:outline-none bg-white"
                    placeholder="jordan-and-eden-faith"
                  />
                </div>
                <p className="text-xs text-[#a08060] mt-1">Lowercase letters, numbers, and hyphens only</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#3b2f2f] mb-1">
                  Wedding date <span className="text-[#a08060] font-normal">(optional)</span>
                </label>
                <input type="date" value={weddingDate} onChange={e => setWeddingDate(e.target.value)}
                  className={inputCls} />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(1)}
                  className="flex-1 rounded-xl border border-[#e8dcc8] py-3 font-semibold text-[#3b2f2f] hover:bg-[#fdfaf6] transition text-sm">
                  ← Back
                </button>
                <button onClick={() => setStep(3)} disabled={!slug.trim()}
                  className="flex-1 rounded-xl bg-[#3b2f2f] py-3 font-semibold text-white hover:bg-[#5c4033] disabled:opacity-50 transition">
                  Continue →
                </button>
              </div>
            </div>
          )}

          {/* Step 3 — Confirm */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <p className="text-3xl mb-3">🎉</p>
                <h2 className="font-serif text-2xl font-bold text-[#3b2f2f] mb-1">Ready to launch</h2>
                <p className="text-sm text-[#a08060]">Your wedding website will be live at the URL below</p>
              </div>

              <div className="rounded-xl bg-[#fdfaf6] border border-[#e8dcc8] p-5 space-y-3">
                <Row label="Couple" value={`${partnerOneName} & ${partnerTwoName}`} />
                <Row label="URL" value={`altarwed.com/wedding/${slug}`} />
                {weddingDate && <Row label="Date" value={new Date(weddingDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} />}
              </div>

              <p className="text-xs text-center text-[#a08060]">
                Your site starts as a draft — publish it when you&apos;re ready for guests to see it.
              </p>

              {error && <p className="text-sm text-red-600 text-center">{error}</p>}

              <div className="flex gap-3">
                <button onClick={() => setStep(2)}
                  className="flex-1 rounded-xl border border-[#e8dcc8] py-3 font-semibold text-[#3b2f2f] hover:bg-[#fdfaf6] transition text-sm">
                  ← Back
                </button>
                <button onClick={handleFinish} disabled={submitting}
                  className="flex-1 rounded-xl bg-[#d4af6a] py-3 font-semibold text-white hover:bg-[#b8923e] disabled:opacity-60 transition">
                  {submitting ? 'Creating…' : 'Create my site ✨'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-sm text-[#a08060] shrink-0">{label}</span>
      <span className="text-sm font-medium text-[#3b2f2f] text-right">{value}</span>
    </div>
  )
}
