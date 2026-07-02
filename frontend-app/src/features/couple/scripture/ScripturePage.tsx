import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/core/api/client'
import { useAuth } from '@/core/auth/AuthContext'
import { useWeddingWebsite } from '@/features/couple/website/useWeddingWebsite'
import PageHeader from '@/components/PageHeader'

interface VerseResult {
  reference: string
  text: string
}

const TRANSLATION_OPTIONS = ['NIV', 'NIV84', 'ESV', 'KJV', 'NKJV', 'NLT', 'CSB', 'NASB', 'HCSB', 'MSG']

function useScriptureFeatured() {
  return useQuery<{ references: string[] }>({
    queryKey: ['scripture-featured'],
    queryFn: () => apiClient.get('/api/v1/scripture/featured').then(r => r.data),
    staleTime: Infinity,
  })
}

function useScriptureSearch() {
  return useMutation<VerseResult, Error, string>({
    mutationFn: (q: string) =>
      apiClient.get(`/api/v1/scripture/search?q=${encodeURIComponent(q)}`).then(r => r.data),
  })
}

function usePinScripture(coupleId: string) {
  const qc = useQueryClient()
  return useMutation<void, Error, VerseResult & { translation?: string }>({
    mutationFn: ({ reference, text, translation }) =>
      apiClient
        .patch(`/api/v1/wedding-websites/couple/${coupleId}`, {
          scriptureReference: reference,
          scriptureText: text,
          ...(translation ? { scriptureTranslation: translation } : {}),
        })
        .then(() => undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wedding-website', coupleId] }),
  })
}

function useSaveCustomVerse(coupleId: string) {
  const qc = useQueryClient()
  return useMutation<void, Error, { reference: string; text: string; translation: string }>({
    mutationFn: (data) =>
      apiClient
        .patch(`/api/v1/wedding-websites/couple/${coupleId}`, {
          scriptureReference: data.reference,
          scriptureText: data.text,
          scriptureTranslation: data.translation,
        })
        .then(() => undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wedding-website', coupleId] }),
  })
}

export default function ScripturePage() {
  const { user } = useAuth()
  const coupleId = user?.id ?? ''
  const { data: website } = useWeddingWebsite(coupleId)

  const featured = useScriptureFeatured()
  const search = useScriptureSearch()
  const pin = usePinScripture(coupleId)
  const saveCustom = useSaveCustomVerse(coupleId)

  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<VerseResult | null>(null)
  const [selectedTranslation, setSelectedTranslation] = useState('ESV')

  // Sync to the saved translation once the website record loads (React Query
  // is async; website is undefined on first render so useState can't use it).
  useEffect(() => {
    if (website?.scriptureTranslation) setSelectedTranslation(website.scriptureTranslation)
  }, [website?.scriptureTranslation])

  // Custom verse form state
  const [customRef, setCustomRef] = useState('')
  const [customText, setCustomText] = useState('')
  const [customTranslation, setCustomTranslation] = useState('ESV')

  const pinnedRef = website?.scriptureReference ?? null

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    search.mutate(query.trim(), {
      onSuccess: (verse) => setSelected(verse),
    })
  }

  const handleFeaturedClick = (ref: string) => {
    search.mutate(ref, {
      onSuccess: (verse) => setSelected(verse),
    })
  }

  const handlePin = () => {
    if (!selected) return
    pin.mutate({ ...selected, translation: selectedTranslation })
  }

  const handleSaveCustom = (e: React.FormEvent) => {
    e.preventDefault()
    if (!customRef.trim() || !customText.trim()) return
    saveCustom.mutate({
      reference: customRef.trim(),
      text: customText.trim(),
      translation: customTranslation,
    }, {
      onSuccess: () => {
        setCustomRef('')
        setCustomText('')
      },
    })
  }

  const inputCls = 'w-full rounded-lg border border-gold-light px-4 py-2.5 text-sm text-brown placeholder-brown-light/60 focus:border-gold focus:outline-none'

  return (
    <div className="min-h-screen bg-ivory">
      <PageHeader
        title="Scripture Builder"
        subtitle="Search for a verse or browse curated wedding scriptures to pin to your website."
        maxWidth="max-w-3xl"
      />

      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-8 space-y-10">

        {/* Currently pinned */}
        {pinnedRef && (
          <div className="rounded-xl border border-gold bg-gold/5 px-5 py-4">
            <p className="text-xs font-medium text-gold uppercase tracking-wide mb-1">Currently pinned</p>
            <p className="font-serif text-brown font-semibold">
              {pinnedRef}
              {website?.scriptureTranslation && (
                <span className="ml-2 text-sm font-normal text-brown-light">({website.scriptureTranslation})</span>
              )}
            </p>
            {website?.scriptureText && (
              <p className="text-sm text-brown-light mt-1 italic line-clamp-2">{website.scriptureText}</p>
            )}
          </div>
        )}

        {/* Search */}
        <section>
          <h2 className="font-serif text-lg font-semibold text-brown mb-3">Search by reference or keyword</h2>
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder='e.g. "1 Corinthians 13" or "John 3:16"'
              className="flex-1 rounded-lg border border-gold-light px-4 py-2.5 text-sm text-brown placeholder-brown-light/60 focus:border-gold focus:outline-none"
            />
            <button
              type="submit"
              disabled={!query.trim() || search.isPending}
              className="rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-brown hover:bg-gold/90 disabled:opacity-50 transition"
            >
              {search.isPending ? 'Looking up…' : 'Look up'}
            </button>
          </form>
          {search.isError && (
            <p className="mt-2 text-xs text-red-600">
              Could not find that verse. Try a format like "John 3:16" or "1 Corinthians 13:4-7".
            </p>
          )}
        </section>

        {/* Verse result */}
        {selected && (
          <section className="rounded-xl border border-gold-light bg-white px-6 py-5 space-y-3">
            <p className="font-serif text-xl font-bold text-brown">{selected.reference}</p>
            <p className="text-sm text-brown-light leading-relaxed italic">"{selected.text}"</p>
            <div className="flex items-center gap-3 pt-1 flex-wrap">
              <label className="text-sm text-brown-light flex items-center gap-2">
                Translation
                <select
                  value={selectedTranslation}
                  onChange={e => setSelectedTranslation(e.target.value)}
                  className="rounded border border-gold-light px-2 py-1 text-sm text-brown focus:border-gold focus:outline-none"
                >
                  {TRANSLATION_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <button
                onClick={handlePin}
                disabled={pin.isPending}
                className="rounded-lg bg-brown px-5 py-2 text-sm font-semibold text-white hover:bg-brown/90 disabled:opacity-50 transition"
              >
                {pin.isPending ? 'Pinning…' : pinnedRef === selected.reference ? 'Re-pin to website' : 'Pin to my website'}
              </button>
              {pin.isSuccess && (
                <span className="text-sm text-green-600 font-medium">Pinned!</span>
              )}
              <button
                onClick={() => setSelected(null)}
                className="text-sm text-brown-light hover:text-brown transition"
              >
                Clear
              </button>
            </div>
          </section>
        )}

        {/* Featured curated verses */}
        <section>
          <h2 className="font-serif text-lg font-semibold text-brown mb-1">Wedding verses</h2>
          <p className="text-sm text-brown-light mb-4">Curated covenant scriptures, click any to preview the full text.</p>

          {featured.isLoading && (
            <p className="text-sm text-brown-light">Loading…</p>
          )}

          {featured.data && (
            <ul className="space-y-2">
              {featured.data.references.map((ref) => {
                const isPinned = pinnedRef === ref
                const isLoading = search.isPending && search.variables === ref
                return (
                  <li key={ref}>
                    <button
                      onClick={() => handleFeaturedClick(ref)}
                      disabled={isLoading}
                      className={
                        'w-full text-left rounded-lg border px-4 py-3 text-sm font-medium transition ' +
                        (isPinned
                          ? 'border-gold bg-gold/10 text-brown'
                          : 'border-gold-light bg-white text-brown hover:border-gold hover:bg-gold/5')
                      }
                    >
                      <span>{ref}</span>
                      {isPinned && (
                        <span className="ml-2 text-xs bg-gold/20 text-gold font-medium px-1.5 py-0.5 rounded-full">
                          Pinned
                        </span>
                      )}
                      {isLoading && <span className="ml-2 text-xs text-brown-light">Loading…</span>}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* Write your own verse */}
        <section className="rounded-xl border border-gold-light bg-white px-6 py-5">
          <h2 className="font-serif text-lg font-semibold text-brown mb-1">Write your own verse</h2>
          <p className="text-sm text-brown-light mb-4">
            Using a family Bible, a specific edition, or a verse our search doesn&apos;t have? Enter it directly.
          </p>
          <form onSubmit={handleSaveCustom} className="space-y-4">
            <div>
              <label htmlFor="custom-ref" className="block text-sm font-medium text-brown mb-1">
                Reference
              </label>
              <input
                id="custom-ref"
                type="text"
                value={customRef}
                onChange={e => setCustomRef(e.target.value)}
                placeholder="e.g. Colossians 3:14"
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="custom-text" className="block text-sm font-medium text-brown mb-1">
                Verse text
              </label>
              <textarea
                id="custom-text"
                value={customText}
                onChange={e => setCustomText(e.target.value)}
                rows={4}
                placeholder="And above all these put on love, which binds everything together in perfect harmony."
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="custom-translation" className="block text-sm font-medium text-brown mb-1">
                Translation
              </label>
              <select
                id="custom-translation"
                value={customTranslation}
                onChange={e => setCustomTranslation(e.target.value)}
                className={inputCls}
              >
                {TRANSLATION_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <button
              type="submit"
              disabled={!customRef.trim() || !customText.trim() || saveCustom.isPending}
              className="w-full rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-brown hover:bg-gold/90 disabled:opacity-50 transition"
            >
              {saveCustom.isPending ? 'Saving…' : 'Save to my website'}
            </button>
            {saveCustom.isSuccess && (
              <p className="text-sm text-green-600 font-medium text-center">Saved!</p>
            )}
          </form>
        </section>

      </main>
    </div>
  )
}
