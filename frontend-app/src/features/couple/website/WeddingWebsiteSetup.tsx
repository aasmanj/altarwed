import { useState } from 'react'
import { useCreateWeddingWebsite } from './useWeddingWebsite'

interface Props {
  coupleId: string
  defaultPartnerOne: string
  defaultPartnerTwo: string
  defaultWeddingDate?: string
}

// Derive a URL slug from the two partner names. Exported so the auto-suggest
// contract is unit-testable in frontend-app's node (no-jsdom) vitest env.
export function suggestSlug(a: string, b: string): string {
  return `${a}-and-${b}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// Decide the slug after a name-field edit. Once the couple has hand-edited the
// slug (slugTouched), their custom value wins and we never overwrite it; until
// then we keep auto-suggesting from the names (issue #188). Pure + exported so
// this decision is verifiable without a DOM.
export function slugAfterNameChange(
  slugTouched: boolean,
  currentSlug: string,
  a: string,
  b: string,
): string {
  return slugTouched ? currentSlug : suggestSlug(a, b)
}

// Decide the slug + touched-state after a manual edit to the slug field itself.
// Clearing the field back to empty releases the "touched" lock so auto-suggest
// can resume, instead of leaving a permanently blank required field once the
// couple has hand-edited the slug once (issue #188 follow-up). Pure + exported
// for the same reason as slugAfterNameChange.
export function slugAfterManualEdit(rawInput: string): { slug: string; touched: boolean } {
  const slug = rawInput.toLowerCase().replace(/[^a-z0-9-]/g, '')
  return { slug, touched: slug.length > 0 }
}

export default function WeddingWebsiteSetup({ coupleId, defaultPartnerOne, defaultPartnerTwo, defaultWeddingDate }: Props) {
  const create = useCreateWeddingWebsite(coupleId)

  const [slug, setSlug] = useState(suggestSlug(defaultPartnerOne, defaultPartnerTwo))
  const [slugTouched, setSlugTouched] = useState(false)
  const [partnerOne, setPartnerOne] = useState(defaultPartnerOne)
  const [partnerTwo, setPartnerTwo] = useState(defaultPartnerTwo)
  const [weddingDate, setWeddingDate] = useState(defaultWeddingDate ?? '')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await create.mutateAsync({
        slug,
        partnerOneName: partnerOne,
        partnerTwoName: partnerTwo,
        weddingDate: weddingDate || undefined,
      })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg ?? 'Something went wrong. Please try again.')
    }
  }

  return (
    <div className="max-w-lg mx-auto py-12 px-6">
      <h2 className="font-serif text-2xl font-bold text-brown mb-2">Create your wedding website</h2>
      <p className="text-brown-light text-sm mb-8">
        Your site will be live at{' '}
        <span className="font-medium text-brown">altarwed.com/wedding/{slug || '…'}</span>
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <Field label="Groom's name">
          <input
            value={partnerOne}
            onChange={e => { setPartnerOne(e.target.value); setSlug(slugAfterNameChange(slugTouched, slug, e.target.value, partnerTwo)) }}
            className={inputCls}
            required
          />
        </Field>

        <Field label="Bride's name">
          <input
            value={partnerTwo}
            onChange={e => { setPartnerTwo(e.target.value); setSlug(slugAfterNameChange(slugTouched, slug, partnerOne, e.target.value)) }}
            className={inputCls}
            required
          />
        </Field>

        <Field label="Your URL slug" hint="Lowercase letters, numbers, and hyphens only">
          <div className="flex items-center rounded-lg border border-gold-light overflow-hidden focus-within:border-gold focus-within:ring-1 focus-within:ring-gold">
            <span className="bg-[#f7f0e6] px-3 py-2.5 text-sm text-brown-light border-r border-gold-light whitespace-nowrap">
              altarwed.com/wedding/
            </span>
            <input
              value={slug}
              onChange={e => {
                const next = slugAfterManualEdit(e.target.value)
                setSlugTouched(next.touched)
                setSlug(next.slug)
              }}
              className="flex-1 px-3 py-2.5 text-brown bg-white focus:outline-none text-sm"
              required
            />
          </div>
        </Field>

        <Field label="Wedding date">
          <input
            type="date"
            value={weddingDate}
            onChange={e => setWeddingDate(e.target.value)}
            className={inputCls}
          />
        </Field>

        <button
          type="submit"
          disabled={create.isPending}
          className="w-full rounded-lg bg-gold py-2.5 font-semibold text-white hover:bg-gold-dark disabled:opacity-60 transition"
        >
          {create.isPending ? 'Creating…' : 'Create my website'}
        </button>
      </form>
    </div>
  )
}

const inputCls = 'w-full rounded-lg border border-gold-light px-4 py-2.5 text-brown focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold text-sm'

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-brown mb-1.5">{label}</label>
      {hint && <p className="text-xs text-brown-light mb-1.5">{hint}</p>}
      {children}
    </div>
  )
}
