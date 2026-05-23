import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/core/auth/AuthContext'
import { ExternalLink, Plus, RefreshCw, Loader2, Eye, CheckCircle2, ImagePlus } from 'lucide-react'
import { apiClient } from '@/core/api/client'
import { useWeddingWebsite, usePublishWeddingWebsite } from '../useWeddingWebsite'
import {
  useBackfillBlocks,
  useCreateBlock,
  useDeleteBlock,
  useReorderBlocks,
  useUpdateBlock,
  useWeddingPageBlocks,
} from './useWeddingPageBlocks'
import SortableBlockList from './SortableBlockList'
import {
  ALLOWED_TYPES_PER_TAB,
  BLOCK_TABS,
  BLOCK_TAB_LABELS,
  BLOCK_TYPE_LABELS,
  type BlockTab,
  type BlockType,
  defaultContentJson,
} from './types'

// The preview URL is on the public marketing domain (frontend-public).
// In prod it is the real altarwed.com origin; in local dev we fall back to
// localhost:3000 so the iframe works without deploying.
const PREVIEW_ORIGIN =
  (import.meta as unknown as { env: { VITE_PUBLIC_BASE_URL?: string } }).env.VITE_PUBLIC_BASE_URL
  ?? 'https://www.altarwed.com'

// Tabs that always make sense to show in the editor, even if empty.
// Each one renders its own preview route via the iframe.
const previewUrl = (slug: string, tab: BlockTab) =>
  `${PREVIEW_ORIGIN}/preview/${slug}/${tab}`

export default function SideBySideEditor() {
  const { user } = useAuth()
  const coupleId = user?.id ?? ''

  const { data: website, isLoading: websiteLoading } = useWeddingWebsite(coupleId)
  const websiteId = website?.id

  const { data: blocks = [], isLoading: blocksLoading } = useWeddingPageBlocks(websiteId)
  const create = useCreateBlock(websiteId ?? '')
  const update = useUpdateBlock(websiteId ?? '')
  const remove = useDeleteBlock(websiteId ?? '')
  const reorder = useReorderBlocks(websiteId ?? '')
  const backfill = useBackfillBlocks(websiteId ?? '')
  const publish = usePublishWeddingWebsite(coupleId)

  const [activeTab, setActiveTab] = useState<BlockTab>('HOME')
  const [picking, setPicking] = useState(false)
  const [previewKey, setPreviewKey] = useState(0)
  const [previewLoading, setPreviewLoading] = useState(true)
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const [heroUploading, setHeroUploading] = useState(false)
  const heroInputRef = useRef<HTMLInputElement>(null)

  // Block counts per tab — used to badge tabs that already have content so
  // couples can see at a glance which sections they've configured.
  const blockCountByTab = useMemo(() => {
    const counts: Partial<Record<BlockTab, number>> = {}
    for (const b of blocks) counts[b.tab] = (counts[b.tab] ?? 0) + 1
    return counts
  }, [blocks])

  const blocksForTab = useMemo(
    () => blocks.filter(b => b.tab === activeTab).sort((a, b) => a.sortOrder - b.sortOrder),
    [blocks, activeTab],
  )

  // ── Auto-backfill on first entry ─────────────────────────────────────────
  // If the couple has scalar fields (story, venue, hotel, etc.) but zero
  // blocks, seed defaults so they don't land on an empty editor. Idempotent
  // server-side, but we still guard with a ref to avoid double-calls during
  // React Strict Mode dev re-renders.
  const backfilledRef = useRef(false)
  useEffect(() => {
    if (
      !backfilledRef.current
      && websiteId
      && !blocksLoading
      && blocks.length === 0
      && !backfill.isPending
    ) {
      backfilledRef.current = true
      backfill.mutate()
    }
  }, [websiteId, blocksLoading, blocks.length, backfill])

  if (websiteLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-brown-light" size={20} />
      </div>
    )
  }
  if (!website) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center px-4">
        <p className="font-serif text-xl text-brown mb-2">Set up your wedding website first</p>
        <p className="text-sm text-brown-light mb-6">
          The side-by-side editor needs a website to edit. Create yours in the classic editor.
        </p>
        <Link
          to="/dashboard/website"
          className="inline-flex items-center px-5 py-2.5 rounded-lg bg-brown text-white text-sm font-medium hover:bg-brown-dark transition"
        >
          Go to wedding website setup
        </Link>
      </div>
    )
  }
  if (!websiteId) return null

  const liveUrl = `${PREVIEW_ORIGIN}/wedding/${website.slug}`
  const tabPreviewUrl = previewUrl(website.slug, activeTab)

  const bumpPreview = () => {
    setPreviewLoading(true)
    setPreviewKey(k => k + 1)
    setLastSavedAt(Date.now())
  }

  const handleAdd = (type: BlockType) => {
    setPicking(false)
    create.mutate(
      { tab: activeTab, type, contentJson: defaultContentJson(type) },
      { onSuccess: bumpPreview },
    )
  }
  const handleUpdate = (blockId: string, contentJson: string) =>
    update.mutate({ blockId, contentJson }, { onSuccess: bumpPreview })
  const handleDelete = (blockId: string) =>
    remove.mutate(blockId, { onSuccess: bumpPreview })
  const handleReorder = (orderedBlockIds: string[]) => {
    reorder.mutate({ tab: activeTab, orderedBlockIds }, { onSuccess: bumpPreview })
  }
  const togglePublish = () => publish.mutate(!website.isPublished, { onSuccess: bumpPreview })

  const handleHeroUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !websiteId) return
    const form = new FormData()
    form.append('file', file)
    setHeroUploading(true)
    try {
      await apiClient.post(`/api/v1/uploads/wedding-websites/${websiteId}/hero`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      bumpPreview()
    } finally {
      setHeroUploading(false)
      // Reset so re-selecting the same file triggers onChange again
      if (heroInputRef.current) heroInputRef.current.value = ''
    }
  }

  const savedAgo = useFriendlyAgo(lastSavedAt)

  return (
    <div className="flex flex-col h-screen">
      {/* ── Editor header ─────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gold-light px-6 py-3 flex-shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/dashboard"
              className="text-sm text-brown-light hover:text-brown transition flex items-center gap-1 flex-shrink-0"
            >
              ← Dashboard
            </Link>
            <span className="text-gold-light">|</span>
            <div className="min-w-0">
              <h1 className="font-serif text-lg font-bold text-brown leading-tight truncate">
                Page Builder
              </h1>
              <p className="text-xs text-brown-light truncate">
                {website.isPublished
                  ? <>Live at <a href={liveUrl} target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">{website.slug}</a></>
                  : <>Draft — only you can see this preview</>
                }
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {savedAgo && (
              <span className="hidden sm:inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
                <CheckCircle2 size={12} /> Saved {savedAgo}
              </span>
            )}
            <a
              href={tabPreviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-brown-light hover:text-brown inline-flex items-center gap-1 px-2 py-1.5 rounded hover:bg-stone-100"
              title="Open this tab's preview in a new browser tab"
            >
              <ExternalLink size={12} /> Preview tab
            </a>
            <button
              onClick={togglePublish}
              disabled={publish.isPending}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg transition disabled:opacity-50 ${
                website.isPublished
                  ? 'text-brown bg-stone-100 hover:bg-stone-200'
                  : 'text-white bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {publish.isPending
                ? 'Saving…'
                : website.isPublished ? 'Unpublish' : 'Publish'}
            </button>
          </div>
        </div>
      </header>

      {/* ── Main split layout ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-0 flex-1 overflow-hidden">

        {/* Left: live preview iframe */}
        <div className="bg-stone-100 flex flex-col border-r border-gold-light">
          <div className="px-3 py-2 text-xs text-stone-600 border-b border-stone-200 flex items-center justify-between bg-white">
            <div className="flex items-center gap-2 min-w-0">
              <Eye size={12} className="text-stone-400 flex-shrink-0" />
              <span className="truncate">{tabPreviewUrl}</span>
            </div>
            <button
              onClick={bumpPreview}
              className="text-stone-500 hover:text-stone-900 inline-flex items-center gap-1 flex-shrink-0"
              title="Reload preview"
            >
              <RefreshCw size={11} /> Refresh
            </button>
          </div>
          <div className="flex-1 relative">
            {previewLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/60 z-10 pointer-events-none">
                <Loader2 className="animate-spin text-brown-light" size={20} />
              </div>
            )}
            <iframe
              key={previewKey}
              src={tabPreviewUrl}
              title={`Wedding website preview — ${BLOCK_TAB_LABELS[activeTab]} tab`}
              className="w-full h-full bg-white"
              onLoad={() => setPreviewLoading(false)}
            />
          </div>
        </div>

        {/* Right: block editor */}
        <div className="bg-white flex flex-col overflow-hidden">
          {/* Hero photo upload — page-level setting above block tabs */}
          <div className="border-b border-stone-200 px-3 py-2.5 flex-shrink-0 bg-stone-50 flex items-center gap-3">
            <div
              className="w-12 h-8 rounded overflow-hidden border border-stone-200 flex-shrink-0 bg-stone-200 flex items-center justify-center"
              title="Current hero photo"
            >
              {website.heroPhotoUrl
                ? <img src={website.heroPhotoUrl} alt="Hero" className="w-full h-full object-cover" />
                : <ImagePlus size={14} className="text-stone-400" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-stone-700 leading-none mb-0.5">Hero photo</p>
              <p className="text-[10px] text-stone-400 leading-none">JPEG / PNG / WebP, max 15 MB</p>
            </div>
            <input
              ref={heroInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleHeroUpload}
            />
            <button
              onClick={() => heroInputRef.current?.click()}
              disabled={heroUploading}
              className="text-xs px-2.5 py-1.5 rounded-md bg-white border border-stone-300 hover:border-gold hover:text-brown transition text-stone-600 disabled:opacity-50 flex items-center gap-1 flex-shrink-0"
            >
              {heroUploading ? <><Loader2 size={11} className="animate-spin" /> Uploading…</> : <><ImagePlus size={11} /> Change</>}
            </button>
          </div>

          {/* Tab bar — shows block counts as a badge */}
          <div className="border-b border-stone-200 overflow-x-auto flex-shrink-0">
            <div className="flex">
              {BLOCK_TABS.map(t => {
                const count = blockCountByTab[t] ?? 0
                const isActive = activeTab === t
                return (
                  <button
                    key={t}
                    onClick={() => {
                      setActiveTab(t)
                      bumpPreview()
                    }}
                    className={`px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition inline-flex items-center gap-1.5 ${
                      isActive
                        ? 'border-gold text-brown'
                        : 'border-transparent text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    {BLOCK_TAB_LABELS[t]}
                    {count > 0 && (
                      <span className={`text-[10px] font-semibold rounded-full px-1.5 py-0.5 min-w-[18px] text-center ${
                        isActive ? 'bg-gold/20 text-brown' : 'bg-stone-200 text-stone-600'
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Block list */}
          <div className="flex-1 overflow-y-auto px-3 py-3">
            {blocksLoading || (backfill.isPending && blocks.length === 0) ? (
              <div className="flex items-center gap-2 text-sm text-stone-500 py-8 justify-center">
                <Loader2 className="animate-spin" size={14} />
                {backfill.isPending ? 'Setting up your page…' : 'Loading blocks…'}
              </div>
            ) : blocksForTab.length === 0 ? (
              <EmptyTabState
                tab={activeTab}
                onAdd={() => setPicking(true)}
              />
            ) : (
              <SortableBlockList
                blocks={blocksForTab}
                onReorder={handleReorder}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
              />
            )}

            {/* Add-block UI — always visible at the bottom when there are blocks */}
            {!blocksLoading && blocksForTab.length > 0 && (
              <div className="mt-3">
                {picking ? (
                  <BlockPicker
                    tab={activeTab}
                    onPick={handleAdd}
                    onCancel={() => setPicking(false)}
                  />
                ) : (
                  <button
                    onClick={() => setPicking(true)}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-stone-300 hover:border-gold hover:bg-amber-50 px-3 py-2.5 text-sm text-stone-600 hover:text-brown transition"
                  >
                    <Plus size={14} /> Add block
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Footer hint about backfill — kept subtle */}
          <div className="border-t border-stone-200 px-3 py-2 text-[11px] text-stone-500 bg-stone-50 flex items-center justify-between flex-shrink-0">
            <span>Edits save automatically.</span>
            <button
              onClick={() => backfill.mutate()}
              disabled={backfill.isPending}
              className="text-stone-500 hover:text-stone-900 inline-flex items-center gap-1 disabled:opacity-50"
              title="Re-seed defaults from your wedding website fields (skips tabs you've already edited)"
            >
              <RefreshCw size={10} /> Re-seed defaults
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Subcomponents ──────────────────────────────────────────────────────────

function EmptyTabState({ tab, onAdd }: { tab: BlockTab; onAdd: () => void }) {
  const description = TAB_HINTS[tab] ?? 'Add a block to start building this tab.'
  return (
    <div className="border-2 border-dashed border-stone-300 rounded-xl px-4 py-10 text-center bg-stone-50/50">
      <p className="font-serif text-base text-brown mb-1">
        Nothing on the {BLOCK_TAB_LABELS[tab]} tab yet
      </p>
      <p className="text-xs text-stone-500 mb-5 max-w-xs mx-auto leading-relaxed">
        {description}
      </p>
      <button
        onClick={onAdd}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brown text-white text-sm font-medium hover:bg-brown-dark transition"
      >
        <Plus size={14} /> Add your first block
      </button>
    </div>
  )
}

function BlockPicker({
  tab, onPick, onCancel,
}: {
  tab: BlockTab
  onPick: (type: BlockType) => void
  onCancel: () => void
}) {
  return (
    <div className="rounded-lg border border-gold-light bg-amber-50 p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-brown">Pick a block to add</p>
        <button
          onClick={onCancel}
          className="text-xs text-stone-500 hover:text-stone-700"
        >
          Cancel
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {ALLOWED_TYPES_PER_TAB[tab].map(type => (
          <button
            key={type}
            onClick={() => onPick(type)}
            className="text-left text-xs px-2.5 py-2 rounded bg-white border border-stone-200 hover:border-gold hover:bg-amber-100/40 transition"
          >
            {BLOCK_TYPE_LABELS[type]}
          </button>
        ))}
      </div>
    </div>
  )
}

// Friendly per-tab hint shown in the empty state. Couples without context
// often don't know what each tab is supposed to contain — these one-liners
// reduce that friction.
const TAB_HINTS: Record<BlockTab, string> = {
  HOME: 'This is the landing page. Add a heading, your favorite scripture, or a countdown to your wedding day.',
  OUR_STORY: 'Tell your guests how you met, when you knew, and what God has done in your relationship.',
  DETAILS: 'Ceremony time, venue, dress code, what to expect — all the practical info your guests need.',
  WEDDING_PARTY: 'Add a grid for your bridesmaids and groomsmen. Pulls from the Wedding Party tab of the dashboard.',
  REGISTRY: 'Link to your registries. Configure URLs in the classic Wedding Website editor, then show them here.',
  TRAVEL: 'Hotels, airports, and travel guidance for out-of-town guests.',
  PHOTOS: 'Add a photo album. Upload from the Photos tab of the dashboard, then it appears here.',
  RSVP: 'Show a call-to-action so guests RSVP. Add a countdown and a few details about the day.',
}

// Returns a friendly "just now", "5s ago", "2m ago" string for a timestamp.
// Re-renders every 5 seconds so the value stays current without a setInterval
// on every blur. Returns null if no timestamp.
function useFriendlyAgo(ts: number | null): string | null {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (ts == null) return
    const id = window.setInterval(() => setTick(t => t + 1), 5000)
    return () => window.clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ts])
  if (ts == null) return null
  void tick
  const seconds = Math.floor((Date.now() - ts) / 1000)
  if (seconds < 3) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  return 'a while ago'
}
