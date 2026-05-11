import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/core/api/client'
import { useAuth } from '@/core/auth/AuthContext'
import { useWeddingWebsite } from '@/features/couple/website/useWeddingWebsite'
import PageHeader from '@/components/PageHeader'

interface VerseResult {
  reference: string
  text: string
}

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
  return useMutation<void, Error, VerseResult>({
    mutationFn: ({ reference, text }: VerseResult) =>
      apiClient
        .patch(`/api/v1/wedding-websites/couple/${coupleId}`, {
          scriptureReference: reference,
          scriptureText: text,
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

  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<VerseResult | null>(null)

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
    pin.mutate(selected)
  }

  return (
    <div className="min-h-screen bg-ivory">
      <PageHeader
        title="Scripture Builder"
        subtitle="Search for a verse or browse curated wedding scriptures to pin to your website."
      />

      <main className="mx-auto max-w-3xl px-6 py-8 space-y-10">

        {/* Currently pinned */}
        {pinnedRef && (
          <div className="rounded-xl border border-gold bg-gold/5 px-5 py-4">
            <p className="text-xs font-medium text-gold uppercase tracking-wide mb-1">Currently pinned</p>
            <p className="font-serif text-brown font-semibold">{pinnedRef}</p>
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
              className="rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-white hover:bg-gold/90 disabled:opacity-50 transition"
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
            <div className="flex items-center gap-3 pt-1">
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
          <p className="text-sm text-brown-light mb-4">Curated covenant scriptures — click any to preview the full text.</p>

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
      </main>
    </div>
  )
}
