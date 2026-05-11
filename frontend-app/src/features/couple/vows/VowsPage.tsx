import { useState } from 'react'
import { useAuth } from '@/core/auth/AuthContext'
import PageHeader from '@/components/PageHeader'
import { useWeddingWebsite, useUpdateWeddingWebsite } from '@/features/couple/website/useWeddingWebsite'

const PROMPTS = [
  'I choose you as my partner in life…',
  'I promise to love you through joy and through hardship…',
  'I will honor the covenant we make before God today…',
  'I will seek to know you more deeply every year…',
  'I will pursue you, pray for you, and grow with you…',
  'As God has loved the church, I will love you…',
]

const STARTERS = [
  { label: 'Traditional opener', text: 'I, [name], take you, [name], to be my wedded spouse…' },
  { label: 'Covenant opener', text: 'Before God and these witnesses, I covenant to love you…' },
  { label: 'Scripture-led', text: '"Love is patient, love is kind." Because of this truth, I promise you…' },
  { label: 'Personal opener', text: 'From the day I met you, I knew…' },
]

export default function VowsPage() {
  const { user } = useAuth()
  const coupleId = user?.id ?? ''
  const { data: website } = useWeddingWebsite(coupleId)
  const update = useUpdateWeddingWebsite(coupleId)

  const [partnerOneVows, setPartnerOneVows] = useState(website?.partnerOneVows ?? '')
  const [partnerTwoVows, setPartnerTwoVows] = useState(website?.partnerTwoVows ?? '')
  const [saved, setSaved] = useState(false)
  const [activePartner, setActivePartner] = useState<1 | 2>(1)

  const partnerOneName = website?.partnerOneName ?? user?.partnerOneName ?? 'Partner 1'
  const partnerTwoName = website?.partnerTwoName ?? 'Partner 2'

  const handleSave = async () => {
    await update.mutateAsync({ partnerOneVows, partnerTwoVows })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const currentVows = activePartner === 1 ? partnerOneVows : partnerTwoVows
  const setCurrentVows = (v: string) => activePartner === 1 ? setPartnerOneVows(v) : setPartnerTwoVows(v)

  const insertStarter = (text: string) => {
    setCurrentVows(currentVows ? `${currentVows}\n\n${text}` : text)
    setSaved(false)
  }

  const insertPrompt = (prompt: string) => {
    setCurrentVows(currentVows ? `${currentVows}\n\n${prompt}` : prompt)
    setSaved(false)
  }

  return (
    <div className="min-h-screen bg-ivory">
      <PageHeader
        title="Vow Builder"
        subtitle="Write and save your wedding vows — just for the two of you."
        action={
          <button
            onClick={handleSave}
            disabled={update.isPending}
            className="rounded-lg bg-brown px-4 py-2 text-sm font-semibold text-white hover:bg-brown/90 disabled:opacity-60 transition"
          >
            {update.isPending ? 'Saving…' : saved ? 'Saved ✓' : 'Save vows'}
          </button>
        }
      />

      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-8 space-y-8">

        {/* Partner tabs */}
        <div className="flex rounded-xl border border-gold-light bg-white overflow-hidden">
          {([1, 2] as const).map(p => {
            const name = p === 1 ? partnerOneName : partnerTwoName
            const vows = p === 1 ? partnerOneVows : partnerTwoVows
            return (
              <button
                key={p}
                onClick={() => setActivePartner(p)}
                className={`flex-1 px-4 py-3 text-sm font-medium transition ${
                  activePartner === p
                    ? 'bg-brown text-white'
                    : 'text-brown-light hover:text-brown hover:bg-ivory'
                }`}
              >
                {name}&apos;s vows
                {vows && <span className="ml-1.5 text-xs opacity-70">({vows.split(' ').length} words)</span>}
              </button>
            )
          })}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">

          {/* Editor */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-brown">
                {activePartner === 1 ? partnerOneName : partnerTwoName}&apos;s vows
              </label>
              <span className="text-xs text-brown-light">
                {currentVows.split(' ').filter(Boolean).length} words
              </span>
            </div>
            <textarea
              value={currentVows}
              onChange={e => { setCurrentVows(e.target.value); setSaved(false) }}
              rows={16}
              placeholder={`Write ${activePartner === 1 ? partnerOneName : partnerTwoName}'s vows here…`}
              className="w-full rounded-xl border border-gold-light px-4 py-3 text-sm text-brown placeholder-brown-light/60 focus:border-gold focus:outline-none resize-none leading-relaxed font-serif"
            />
          </div>

          {/* Sidebar tools */}
          <div className="space-y-5">

            {/* Starters */}
            <div className="rounded-xl border border-gold-light bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-brown-light mb-3">Opening lines</p>
              <div className="space-y-2">
                {STARTERS.map(s => (
                  <button
                    key={s.label}
                    onClick={() => insertStarter(s.text)}
                    className="w-full text-left rounded-lg border border-gold-light px-3 py-2 text-xs text-brown hover:border-gold hover:bg-gold/5 transition"
                  >
                    <span className="font-medium block mb-0.5">{s.label}</span>
                    <span className="text-brown-light line-clamp-1">{s.text}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Writing prompts */}
            <div className="rounded-xl border border-gold-light bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-brown-light mb-3">Prompts</p>
              <div className="space-y-1.5">
                {PROMPTS.map(p => (
                  <button
                    key={p}
                    onClick={() => insertPrompt(p)}
                    className="w-full text-left rounded-lg px-3 py-2 text-xs text-brown hover:bg-gold/5 transition"
                  >
                    + {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Scripture shortcut */}
            <div className="rounded-xl border border-gold-light bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-brown-light mb-2">Scripture</p>
              <p className="text-xs text-brown-light mb-3">Weave a verse into your vows.</p>
              <a
                href="/dashboard/scripture"
                className="block text-center rounded-lg border border-gold px-3 py-2 text-xs font-medium text-brown hover:bg-gold/10 transition"
              >
                Open Scripture Builder →
              </a>
            </div>

            {/* Privacy note */}
            <div className="rounded-xl bg-ivory border border-gold-light p-4">
              <p className="text-xs text-brown-light leading-relaxed">
                <strong className="text-brown">Private by default.</strong> Your vows are saved to your account but never shown on your public wedding website. They&apos;re just for you.
              </p>
            </div>
          </div>
        </div>

        {/* Preview side by side */}
        {(partnerOneVows || partnerTwoVows) && (
          <div>
            <h2 className="font-serif text-xl font-bold text-brown mb-4">Preview</h2>
            <div className="grid sm:grid-cols-2 gap-6">
              {partnerOneVows && (
                <div className="rounded-xl border border-gold-light bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gold mb-3">{partnerOneName}</p>
                  <p className="text-sm text-brown leading-relaxed font-serif whitespace-pre-wrap">{partnerOneVows}</p>
                </div>
              )}
              {partnerTwoVows && (
                <div className="rounded-xl border border-gold-light bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gold mb-3">{partnerTwoName}</p>
                  <p className="text-sm text-brown leading-relaxed font-serif whitespace-pre-wrap">{partnerTwoVows}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
