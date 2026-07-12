import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/core/auth/AuthContext'
import { ExternalLink, Plus, RefreshCw, Loader2, Eye, CheckCircle2, AlertCircle, ImagePlus, Smartphone, Monitor, Settings2, Pencil, ChevronUp, ChevronDown, X } from 'lucide-react'
import { apiClient } from '@/core/api/client'
import { captureEvent } from '@/core/analytics/analytics'
import { fireConfetti } from '@/lib/fireConfetti'
import { useWeddingWebsite, usePublishWeddingWebsite, useUpdateWeddingWebsite, type WeddingWebsite } from '../useWeddingWebsite'
import ShareModal from '../ShareModal'
import DraftBanner from '../DraftBanner'
import WeddingWebsiteSetup from '../WeddingWebsiteSetup'
import {
  useBackfillBlocks,
  useCreateBlock,
  useDeleteBlock,
  useReorderBlocks,
  useUpdateBlock,
  useWeddingPageBlocks,
} from './useWeddingPageBlocks'
import SortableBlockList from './SortableBlockList'
import WebsiteSectionDrawer from './WebsiteSectionDrawer'
import { BlockEditContext, type WebsiteSection } from './blockEditContext'
import { normalizeImageFile, isAllowedImageType, IMAGE_ACCEPT } from '@/lib/normalizeImageFile'
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL, FILE_TOO_LARGE_MESSAGE, uploadErrorMessage } from '@/lib/upload'
import {
  ALLOWED_TYPES_PER_TAB,
  BLOCK_TABS,
  BLOCK_TAB_LABELS,
  BLOCK_TYPE_LABELS,
  BLOCK_TYPE_DESCRIPTIONS,
  type BlockTab,
  type BlockType,
  defaultContentJson,
} from './types'
import {
  TAB_SWITCH_ACK_TIMEOUT_MS,
  originOf,
  nextTabSwitchId,
  makeTabSwitchMessage,
  makeBlocksUpdateMessage,
  isTabSwitchAck,
  isPreviewTabReady,
} from './previewChannel'
import { ACCENT_PRESETS, isAccentPresetSelected } from './accentPresets'
import { FONT_THEME_OPTIONS, parseTabLabels, readFontThemeKey, serializeTabLabels } from './fontThemes'

// The preview URL is on the public marketing domain (frontend-public).
// In prod it is the real altarwed.com origin; in local dev we fall back to
// localhost:3000 so the iframe works without deploying.
const PREVIEW_ORIGIN =
  (import.meta as unknown as { env: { VITE_PUBLIC_BASE_URL?: string } }).env.VITE_PUBLIC_BASE_URL
  ?? 'https://www.altarwed.com'

// MessageEvent.origin is always a bare origin (scheme://host[:port]); normalize
// the configured base URL once so incoming preview messages can be compared
// with strict equality.
const PREVIEW_MESSAGE_ORIGIN = originOf(PREVIEW_ORIGIN)

// Tabs that always make sense to show in the editor, even if empty.
// Each one renders its own preview route via the iframe.
const previewUrl = (slug: string, tab: BlockTab) =>
  `${PREVIEW_ORIGIN}/preview/${slug}/${tab.toLowerCase()}`

export default function SideBySideEditor() {
  const { user } = useAuth()
  const coupleId = user?.id ?? ''
  const location = useLocation()
  const [wizardNotice, setWizardNotice] = useState<string | null>(
    (location.state as { notice?: string } | null)?.notice ?? null
  )
  // Honour ?tab=registry (or any valid tab name, case-insensitive) so external
  // links can deep-link to a specific section -- e.g. the dashboard's Registry
  // card. Mirrors the classic editor's now-retired ?tab= convention. Unknown
  // values fall back to 'HOME' so a typo in the URL doesn't break the editor.
  const [searchParams] = useSearchParams()

  const { data: website, isLoading: websiteLoading, error: websiteError } = useWeddingWebsite(coupleId)
  const websiteId = website?.id
  const websiteIsNotFound = (websiteError as { response?: { status?: number } } | null)?.response?.status === 404

  const updateWebsite = useUpdateWeddingWebsite(coupleId)
  const { data: blocks = [], isLoading: blocksLoading } = useWeddingPageBlocks(websiteId)
  const create = useCreateBlock(websiteId ?? '')
  const update = useUpdateBlock(websiteId ?? '')
  const remove = useDeleteBlock(websiteId ?? '')
  const reorder = useReorderBlocks(websiteId ?? '')
  const backfill = useBackfillBlocks(websiteId ?? '')
  const publish = usePublishWeddingWebsite(coupleId)

  const [activeTab, setActiveTab] = useState<BlockTab>(() => {
    const tabParam = searchParams.get('tab')?.toUpperCase()
    return (BLOCK_TABS as readonly string[]).includes(tabParam ?? '') ? (tabParam as BlockTab) : 'HOME'
  })
  const [picking, setPicking] = useState(false)
  // Which structured-data section the in-editor drawer is editing (venue,
  // hotels, registry), opened from a data-driven card block. Null = closed.
  const [drawerSection, setDrawerSection] = useState<WebsiteSection | null>(null)
  const [previewKey, setPreviewKey] = useState(0)
  const [previewLoading, setPreviewLoading] = useState(true)
  // The tab the iframe's src attribute points at. Deliberately NOT derived from
  // activeTab: changing an iframe's src triggers a full document navigation even
  // without a key bump, so deriving it from activeTab would reload the preview
  // on every tab click. Tab switches instead go over postMessage (issue #310);
  // only the true reload paths (bumpPreview and the tab-switch fallback below)
  // move this value.
  const [iframeTab, setIframeTab] = useState<BlockTab>(activeTab)
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const [heroUploading, setHeroUploading] = useState(false)
  const [heroUploadError, setHeroUploadError] = useState<string | null>(null)
  // Persisted preview viewport mode. Couples need to know what guests see on
  // phones (the majority of RSVPers) so we expose a one-click mobile toggle.
  // localStorage so the choice survives page reloads.
  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'mobile'>(
    () => (typeof window !== 'undefined' && window.localStorage.getItem('editor.previewViewport') === 'mobile')
      ? 'mobile' : 'desktop',
  )
  useEffect(() => {
    window.localStorage.setItem('editor.previewViewport', previewViewport)
  }, [previewViewport])
  // Last block id added: used to auto-expand the newly created block so the
  // user can start editing immediately instead of hunting for it in the list.
  const [lastAddedBlockId, setLastAddedBlockId] = useState<string | null>(null)
  // Settings drawer (per-tab visibility + custom labels).
  const [settingsOpen, setSettingsOpen] = useState(false)
  // Share modal shown after the draft -> live publish transition (issue #94).
  // Publishing is the bottom-of-funnel viral moment, so the primary editor must
  // prompt the couple to share immediately, mirroring the classic editor.
  const [showShareModal, setShowShareModal] = useState(false)
  const heroInputRef = useRef<HTMLInputElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Width of the preview pane (left side) as a percentage of total width.
  // Persisted in localStorage so couples don't have to re-adjust every visit.
  // Bounded to [30, 75] so neither pane becomes unusable.
  const [previewWidthPct, setPreviewWidthPct] = useState<number>(() => {
    if (typeof window === 'undefined') return 60
    const v = parseFloat(window.localStorage.getItem('editor.previewWidthPct') ?? '60')
    return isFinite(v) && v >= 30 && v <= 75 ? v : 60
  })
  useEffect(() => {
    window.localStorage.setItem('editor.previewWidthPct', String(previewWidthPct))
  }, [previewWidthPct])

  // Track whether we're in lg layout (side-by-side) vs mobile (stacked).
  // The dynamic width only applies on lg; on mobile both panes are full-width.
  const [isLg, setIsLg] = useState(() => window.innerWidth >= 1024)
  useEffect(() => {
    const handler = () => setIsLg(window.innerWidth >= 1024)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // Divider drag. Three mechanics make this feel native instead of glitchy:
  //
  // 1. Pointer Events + setPointerCapture, one unified API for mouse, touch,
  //    and pen. The capture means the divider keeps receiving pointermove
  //    events even when the cursor leaves the element, so we don't need to
  //    attach listeners to window.
  //
  // 2. requestAnimationFrame throttling, pointermove fires at ~120Hz on
  //    high-refresh displays. Reacting on every event causes a re-render +
  //    iframe reflow per frame, which stalls. Coalescing to rAF caps work at
  //    the display refresh rate (the only rate that matters visually).
  //
  // 3. A transparent overlay above the iframe during drag (see JSX below).
  //    Without it, the iframe's content document steals pointermove events as
  //    soon as the cursor crosses it: the divider freezes mid-drag. This is
  //    the same trick VS Code, react-resizable, and Monaco use.
  const splitContainerRef = useRef<HTMLDivElement>(null)
  const dragRafRef = useRef<number | null>(null)
  const dragPendingPctRef = useRef<number | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const flushDrag = useCallback(() => {
    dragRafRef.current = null
    const pct = dragPendingPctRef.current
    if (pct != null) setPreviewWidthPct(pct)
  }, [])

  const startDividerDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Only react to primary button / primary touch. Ignore right-click etc.
    if (e.button !== 0) return
    e.preventDefault()
    const target = e.currentTarget
    const container = splitContainerRef.current
    if (!container) return

    target.setPointerCapture(e.pointerId)
    setIsDragging(true)
    document.body.style.userSelect = 'none'

    const onMove = (ev: PointerEvent) => {
      const rect = container.getBoundingClientRect()
      const pct = ((ev.clientX - rect.left) / rect.width) * 100
      dragPendingPctRef.current = Math.min(75, Math.max(30, pct))
      if (dragRafRef.current == null) {
        dragRafRef.current = window.requestAnimationFrame(flushDrag)
      }
    }
    const stop = () => {
      target.removeEventListener('pointermove', onMove)
      target.removeEventListener('pointerup', stop)
      target.removeEventListener('pointercancel', stop)
      try { target.releasePointerCapture(e.pointerId) } catch { /* already released */ }
      if (dragRafRef.current != null) {
        window.cancelAnimationFrame(dragRafRef.current)
        dragRafRef.current = null
      }
      // Flush any final pending value so the divider lands exactly where the
      // cursor lifted, not one frame behind.
      flushDrag()
      document.body.style.userSelect = ''
      setIsDragging(false)
    }
    target.addEventListener('pointermove', onMove)
    target.addEventListener('pointerup', stop)
    target.addEventListener('pointercancel', stop)
  }, [flushDrag])

  // Keyboard accessibility: arrow keys nudge by 2%, Shift+arrow by 5%,
  // Home/End jump to bounds. Standard ARIA separator behaviour.
  const handleDividerKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 5 : 2
    let next: number | null = null
    if (e.key === 'ArrowLeft')  next = previewWidthPct - step
    if (e.key === 'ArrowRight') next = previewWidthPct + step
    if (e.key === 'Home')       next = 30
    if (e.key === 'End')        next = 75
    if (next == null) return
    e.preventDefault()
    setPreviewWidthPct(Math.min(75, Math.max(30, next)))
  }, [previewWidthPct])

  // Clean up any in-flight rAF if the component unmounts mid-drag.
  useEffect(() => () => {
    if (dragRafRef.current != null) window.cancelAnimationFrame(dragRafRef.current)
  }, [])

  // Hooks must run on every render in the same order, so this stays above the
  // early returns below. The hook itself returns null when lastSavedAt is null,
  // so calling it before we have data is safe.
  const savedAgo = useFriendlyAgo(lastSavedAt)

  // Send a live-preview message to the iframe. The preview page's HeroLive
  // listens for these and patches the DOM without a server round-trip: used
  // for tagline + name fields so typing feels instant.
  const sendPreviewUpdate = useCallback((field: string, value: unknown) => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'preview-update', field, value },
      PREVIEW_ORIGIN,
    )
  }, [])

  // ── Tab switching without an iframe remount (issue #310) ────────────────
  // Clicking a tab used to bump previewKey, remounting the iframe and paying a
  // full SSR round trip (white flash + spinner) on the editor's most-clicked
  // control. Instead we postMessage a 'tab-switch' and the preview swaps tabs
  // with a client-side navigation. If the preview does not ack within
  // TAB_SWITCH_ACK_TIMEOUT_MS (older preview deploy, iframe never loaded), we
  // fall back to the old full reload so the couple is never stuck.
  const pendingTabSwitchRef = useRef<{ tab: BlockTab; switchId: number; timer: number } | null>(null)

  // Full iframe reload at a specific tab: the only paths that move the iframe's
  // src. Also cancels any pending tab-switch fallback, since the reload itself
  // lands on the requested tab.
  const reloadPreview = useCallback((tab: BlockTab) => {
    const pending = pendingTabSwitchRef.current
    if (pending) {
      window.clearTimeout(pending.timer)
      pendingTabSwitchRef.current = null
    }
    setIframeTab(tab)
    setPreviewLoading(true)
    setPreviewKey(k => k + 1)
  }, [])

  const switchPreviewTab = useCallback((tab: BlockTab) => {
    // A newer click supersedes any pending switch.
    const pending = pendingTabSwitchRef.current
    if (pending) window.clearTimeout(pending.timer)
    const win = iframeRef.current?.contentWindow
    if (!win) {
      reloadPreview(tab)
      return
    }
    // Every request gets a fresh id so a stale ack for a superseded same-tab
    // request (rapid A -> B -> A clicks) can never satisfy this newer switch's
    // fallback timer -- see previewChannel.ts.
    const switchId = nextTabSwitchId()
    win.postMessage(makeTabSwitchMessage(tab, switchId), PREVIEW_ORIGIN)
    const timer = window.setTimeout(() => {
      pendingTabSwitchRef.current = null
      reloadPreview(tab)
    }, TAB_SWITCH_ACK_TIMEOUT_MS)
    pendingTabSwitchRef.current = { tab, switchId, timer }
  }, [reloadPreview])

  // Block counts per tab: used to badge tabs that already have content so
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

  // Push the current tab's blocks to the preview iframe whenever they change.
  // React Query's optimistic updates fire on mutation start, so the preview
  // updates before the backend round-trip completes, typing feels instant.
  // Same pattern as HeroLive, just for the full block list. Must live above
  // the early-return guards so the hook order stays stable across renders.
  useEffect(() => {
    if (!iframeRef.current) return
    // Tagged with the tab so a preview mid-navigation between tabs can drop
    // updates meant for a different tab instead of flashing them briefly.
    iframeRef.current.contentWindow?.postMessage(
      makeBlocksUpdateMessage(activeTab, blocksForTab),
      PREVIEW_ORIGIN,
    )
  }, [activeTab, blocksForTab])

  // Listen for the preview's replies to the tab-switch channel above.
  // 'tab-switch-ack' cancels the reload fallback; 'preview-tab-ready' (a
  // preview document finished mounting after a client-side tab swap) triggers
  // a blocks resend so edits made while the navigation was in flight are not
  // lost. Origin-checked as strictly as the preview checks our messages.
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.origin !== PREVIEW_MESSAGE_ORIGIN) return
      const pending = pendingTabSwitchRef.current
      if (pending && isTabSwitchAck(e.data, pending.tab, pending.switchId)) {
        window.clearTimeout(pending.timer)
        pendingTabSwitchRef.current = null
        return
      }
      if (isPreviewTabReady(e.data, activeTab)) {
        iframeRef.current?.contentWindow?.postMessage(
          makeBlocksUpdateMessage(activeTab, blocksForTab),
          PREVIEW_ORIGIN,
        )
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [activeTab, blocksForTab])

  // Clear any pending fallback timer if the editor unmounts mid-switch.
  useEffect(() => () => {
    const pending = pendingTabSwitchRef.current
    if (pending) window.clearTimeout(pending.timer)
  }, [])

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
    // A real (non-404) error -- e.g. a transient 5xx -- must NOT fall through to
    // the creation form below: this couple likely already has a website, and
    // showing "create yours" risks a duplicate-website conflict on submit.
    if (websiteError && !websiteIsNotFound) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
          <p className="text-brown font-medium">Something went wrong loading your website.</p>
          <p className="text-sm text-brown-light">Try refreshing, or <a href="/dashboard" className="text-gold hover:underline">go back to the dashboard</a>.</p>
        </div>
      )
    }
    // Issue #181: the page builder is the sole editor, so it also owns website
    // creation now -- no more hand-off to a separate "classic editor" route.
    // useCreateWeddingWebsite's success invalidates the useWeddingWebsite query
    // above, which flips `website` from undefined to the new record and this
    // component re-renders straight into the normal editor, no extra plumbing.
    return (
      <WeddingWebsiteSetup
        coupleId={coupleId}
        defaultPartnerOne={user?.partnerOneName ?? ''}
        defaultPartnerTwo=""
        defaultWeddingDate=""
      />
    )
  }
  if (!websiteId) return null

  const liveUrl = `${PREVIEW_ORIGIN}/wedding/${website.slug}`
  const tabPreviewUrl = previewUrl(website.slug, activeTab)
  const coupleNames = `${website.partnerOneName} & ${website.partnerTwoName}`
  // True when the most recent content save failed and has not been superseded by a
  // successful one. Drives the persistent "Save failed" pill (#95), a sticky signal
  // that outlives the auto-dismissing toast.
  const saveFailed = updateWebsite.isError || create.isError || update.isError || remove.isError || reorder.isError

  // Full iframe reload. Used only for changes the live-preview channel can't
  // express: hero photo upload (server-rendered Image), publish toggle (toggles
  // the draft watermark), template/settings saves, manual refresh button.
  // Tab switches do NOT come through here anymore (issue #310); they go over
  // the postMessage tab-switch channel via switchPreviewTab.
  const bumpPreview = () => {
    reloadPreview(activeTab)
    setLastSavedAt(Date.now())
  }

  // Lightweight save acknowledgement that does NOT reload the iframe. Block
  // mutations push updates to the preview via postMessage (see effect above),
  // so the iframe never needs to refetch for content edits.
  const markSaved = () => setLastSavedAt(Date.now())

  const handleAdd = (type: BlockType) => {
    setPicking(false)
    create.mutate(
      { tab: activeTab, type, contentJson: defaultContentJson(type) },
      {
        onSuccess: (created) => {
          // Auto-expand the newly created block in the list so the couple
          // starts editing immediately. Pattern matches Notion/Linear: "add"
          // implicitly means "add and start editing", not "add and find later".
          // Clear on the next macrotask so the row mounts with initiallyExpanded
          // true, but a later tab-switch + return does not re-open it.
          setLastAddedBlockId(created.id)
          window.setTimeout(() => setLastAddedBlockId(null), 0)
          markSaved()
        },
      },
    )
  }
  const handleUpdate = (blockId: string, contentJson: string) =>
    update.mutate({ blockId, contentJson }, { onSuccess: markSaved })
  const handleDelete = (blockId: string) =>
    remove.mutate(blockId, { onSuccess: markSaved })
  const handleReorder = (orderedBlockIds: string[]) => {
    reorder.mutate({ tab: activeTab, orderedBlockIds }, { onSuccess: markSaved })
  }
  const togglePublish = () => {
    const publishing = !website.isPublished
    publish.mutate(publishing, {
      onSuccess: () => {
        bumpPreview()
        // Fire only on the publish transition (not unpublish): this is the
        // bottom-of-funnel "a live wedding site now exists" conversion, the event
        // that closes signup -> created -> published.
        if (publishing) {
          captureEvent('website_published', { slug: website.slug })
          // Mirror the classic editor: confetti + the ShareModal prompting the
          // couple to send their new live link at the highest-leverage instant.
          fireConfetti({ particleCount: 120, spread: 80, origin: { y: 0.5 }, colors: ['#d4af6a', '#3b2f2f', '#f5ede0'] })
          setShowShareModal(true)
        }
      },
    })
  }

  const handleHeroUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0]
    if (!picked || !websiteId) return
    setHeroUploadError(null)
    const file = await normalizeImageFile(picked)
    if (!isAllowedImageType(file)) {
      setHeroUploadError('Format not supported. Please upload a JPEG, PNG, or WebP photo.')
      if (heroInputRef.current) heroInputRef.current.value = ''
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setHeroUploadError(FILE_TOO_LARGE_MESSAGE)
      if (heroInputRef.current) heroInputRef.current.value = ''
      return
    }
    const form = new FormData()
    form.append('file', file)
    setHeroUploading(true)
    try {
      await apiClient.post(`/api/v1/uploads/wedding-websites/${websiteId}/hero`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      bumpPreview()
    } catch (err: unknown) {
      setHeroUploadError(uploadErrorMessage(err))
    } finally {
      setHeroUploading(false)
      // Reset so re-selecting the same file triggers onChange again
      if (heroInputRef.current) heroInputRef.current.value = ''
    }
  }

  return (
    <BlockEditContext.Provider value={setDrawerSection}>
    <div className="flex flex-col h-screen">
      {/* ── Editor header ─────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gold-light px-6 py-3 flex-shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/dashboard"
              className="text-sm text-brown-light hover:text-brown transition flex items-center gap-1 flex-shrink-0"
            >
              ← Back to dashboard
            </Link>
            <span className="text-gold-light">|</span>
            <div className="min-w-0">
              <h1 className="font-serif text-lg font-bold text-brown leading-tight truncate">
                Page Builder
              </h1>
              <p className="text-xs text-brown-light truncate">
                {website.isPublished
                  ? <>Live at <a href={liveUrl} target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">{website.slug}</a></>
                  : <>Draft: only you can see this preview</>
                }
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {saveFailed ? (
              <span role="status" className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-50 px-2 py-1 rounded-full">
                <AlertCircle size={12} /> Save failed
              </span>
            ) : savedAgo && (
              <span className="hidden sm:inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
                <CheckCircle2 size={12} /> Saved {savedAgo}
              </span>
            )}
            {/* When published, open the real public page. When still a draft,
                the public page 404s, so open the owner-only preview route for the
                current tab instead. */}
            <a
              href={website.isPublished ? liveUrl : tabPreviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-brown-light hover:text-brown inline-flex items-center gap-1 px-2 py-1.5 rounded hover:bg-stone-100"
              title={website.isPublished
                ? 'Open the real public wedding page in a new tab'
                : 'Preview your unpublished site in a new tab'}
            >
              {website.isPublished
                ? <><ExternalLink size={12} /> View live</>
                : <><Eye size={12} /> Preview</>}
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

      {/* Persistent draft reminder (#159): the header's Publish button is the
          only signal today, and it is easy to miss after onboarding. This
          banner reuses togglePublish, which publishes (with confetti + share
          prompt) whenever the site is a draft. */}
      <DraftBanner
        isPublished={website.isPublished}
        onPublish={togglePublish}
        isPublishing={publish.isPending}
      />

      {/* Notice from onboarding wizard when hero upload failed mid-flow */}
      {wizardNotice && (
        <div role="alert" className="flex items-start gap-3 bg-amber-50 border-b border-amber-200 px-6 py-3 text-sm text-amber-900">
          <span className="flex-1">{wizardNotice}</span>
          <button
            onClick={() => setWizardNotice(null)}
            aria-label="Dismiss"
            className="text-amber-600 hover:text-amber-900 flex-shrink-0 leading-none"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── Main split layout ───────────────────────────────────────────
          Flex with explicit percentages so the draggable divider can resize
          the panes. On mobile we fall back to stacked (single column).
          `relative` so the drag overlay (below) can be absolutely positioned
          across the whole split area. */}
      <div ref={splitContainerRef} className="relative flex flex-col lg:flex-row gap-0 flex-1 overflow-hidden">

        {/* Left: live preview iframe */}
        <div
          className="bg-stone-100 flex flex-col min-w-0"
          style={isLg ? { width: `${previewWidthPct}%` } : undefined}
        >
          <div className="px-3 py-2 text-xs text-stone-600 border-b border-stone-200 flex items-center justify-between gap-2 bg-white">
            <div className="flex items-center gap-2 min-w-0">
              <Eye size={12} className="text-stone-400 flex-shrink-0" />
              <span className="truncate">{tabPreviewUrl}</span>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Viewport toggle: most guests RSVP on phones, so couples need to
                  see what the mobile experience looks like. Desktop is the default
                  because the iframe is wider than a phone. */}
              <div className="inline-flex rounded border border-stone-200 overflow-hidden" role="group" aria-label="Preview viewport">
                <button
                  onClick={() => setPreviewViewport('desktop')}
                  className={`px-1.5 py-1 transition ${previewViewport === 'desktop' ? 'bg-stone-200 text-brown' : 'text-stone-400 hover:text-stone-700'}`}
                  title="Desktop preview"
                  aria-pressed={previewViewport === 'desktop'}
                >
                  <Monitor size={11} />
                </button>
                <button
                  onClick={() => setPreviewViewport('mobile')}
                  className={`px-1.5 py-1 transition ${previewViewport === 'mobile' ? 'bg-stone-200 text-brown' : 'text-stone-400 hover:text-stone-700'}`}
                  title="Mobile preview (375px)"
                  aria-pressed={previewViewport === 'mobile'}
                >
                  <Smartphone size={11} />
                </button>
              </div>
              <button
                onClick={bumpPreview}
                className="text-stone-500 hover:text-stone-900 inline-flex items-center gap-1 px-1.5"
                title="Reload preview"
              >
                <RefreshCw size={11} /> Refresh
              </button>
            </div>
          </div>
          <div className="flex-1 relative overflow-auto bg-stone-100">
            {previewLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/60 z-10 pointer-events-none">
                <Loader2 className="animate-spin text-brown-light" size={20} />
              </div>
            )}
            {/* Mobile viewport: iframe is clamped to phone width and centred in
                a soft-shadowed frame so it visually reads as a device. Desktop
                falls back to fill-width. */}
            <div
              className={previewViewport === 'mobile'
                ? 'mx-auto my-4 w-[375px] max-w-full h-[calc(100%-2rem)] rounded-2xl border-4 border-stone-800 overflow-hidden shadow-xl'
                : 'w-full h-full'}
            >
            <iframe
              ref={iframeRef}
              key={previewKey}
              // src uses iframeTab (the tab of the last real load), NOT activeTab:
              // an iframe src change is itself a full document navigation, so
              // deriving src from activeTab would reload the preview on every
              // tab click even without a key bump. Tab switches navigate the
              // iframe client-side over postMessage instead (issue #310).
              src={previewUrl(website.slug, iframeTab)}
              title={`Wedding website preview: ${BLOCK_TAB_LABELS[activeTab]} tab`}
              className="w-full h-full bg-white"
              onLoad={() => {
                setPreviewLoading(false)
                // Sync current blocks to the freshly loaded preview. Handles the
                // race where the couple edits a block before the iframe finishes
                // loading: the postMessage effect fires before BlockListLive is
                // listening, so we resend the latest state on load.
                iframeRef.current?.contentWindow?.postMessage(
                  makeBlocksUpdateMessage(activeTab, blocksForTab),
                  PREVIEW_ORIGIN,
                )
              }}
            />
            </div>
          </div>
        </div>

        {/* Draggable divider: only visible on lg screens. 8px hit area, 2px
            visible bar centred inside. Pointer events (not mouse) cover touch
            and pen too. role=separator + keyboard makes it accessible.
            `touch-action: none` prevents the browser from scroll-hijacking the
            drag on touch devices.
            eslint-disable below: role="separator" with aria-valuenow IS an
            interactive widget per the ARIA spec (a focusable splitter), but
            jsx-a11y's heuristics treat <div role=separator> as non-interactive. */}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
        <div
          onPointerDown={startDividerDrag}
          onDoubleClick={() => setPreviewWidthPct(60)}
          onKeyDown={handleDividerKeyDown}
          role="separator"
          aria-orientation="vertical"
          aria-valuemin={30}
          aria-valuemax={75}
          aria-valuenow={Math.round(previewWidthPct)}
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- focusable splitter, see comment above
          tabIndex={0}
          title="Drag to resize, double-click to reset, or use arrow keys"
          className={`hidden lg:flex group cursor-col-resize w-2 z-20 items-center justify-center touch-none select-none outline-none transition focus-visible:ring-2 focus-visible:ring-gold ${
            isDragging ? 'bg-gold/20' : 'hover:bg-gold/10'
          }`}
        >
          <div className={`h-12 w-0.5 rounded-full transition ${
            isDragging ? 'bg-gold' : 'bg-stone-300 group-hover:bg-gold'
          }`} />
        </div>

        {/* Drag overlay: only rendered while the pointer is down. Sits above
            the iframe (z-30 vs the divider's z-20) and covers the full split
            area so the iframe's content document cannot capture pointermove
            events mid-drag. The overlay itself is transparent and inherits the
            col-resize cursor so feedback stays consistent. */}
        {isDragging && (
          <div
            aria-hidden="true"
            className="hidden lg:block absolute inset-0 z-30 cursor-col-resize"
          />
        )}

        {/* Right: block editor */}
        <div
          className="bg-white flex flex-col overflow-hidden min-w-0 flex-1"
          style={isLg ? { width: `${100 - previewWidthPct}%`, flex: 'none' } : undefined}
        >
          {/* Hero section: photo + tagline + names, page-level settings above block tabs */}
          <HeroSettings
            website={website}
            websiteId={websiteId ?? ''}
            heroUploading={heroUploading}
            heroUploadError={heroUploadError}
            onHeroErrorDismiss={() => setHeroUploadError(null)}
            onHeroUploadClick={() => heroInputRef.current?.click()}
            onHeroDrop={async (dropped) => {
              if (!websiteId) return
              setHeroUploadError(null)
              const file = await normalizeImageFile(dropped)
              if (!isAllowedImageType(file)) {
                setHeroUploadError('Format not supported. Please upload a JPEG, PNG, or WebP photo.')
                return
              }
              if (file.size > MAX_UPLOAD_BYTES) {
                setHeroUploadError(FILE_TOO_LARGE_MESSAGE)
                return
              }
              const form = new FormData()
              form.append('file', file)
              setHeroUploading(true)
              try {
                const res = await apiClient.post<{ url: string }>(
                  `/api/v1/uploads/wedding-websites/${websiteId}/hero`, form,
                  { headers: { 'Content-Type': 'multipart/form-data' } },
                )
                if (res.data?.url) sendPreviewUpdate('heroPhotoUrl', res.data.url)
                bumpPreview()
              } catch (err: unknown) {
                setHeroUploadError(uploadErrorMessage(err))
              } finally {
                setHeroUploading(false)
              }
            }}
            onTaglineSave={(tagline) => {
              // Save to DB; the live preview already reflects the new value
              // via postMessage so we do NOT bumpPreview (which would cause an
              // iframe reload and a brief flash).
              updateWebsite.mutate({ heroTagline: tagline })
            }}
            onTaglineLive={(tagline) => sendPreviewUpdate('heroTagline', tagline)}
            onNameSave={(field, value) => updateWebsite.mutate({ [field]: value })}
            onNameLive={(field, value) => sendPreviewUpdate(field, value)}
            onDefaultPhotoSelect={(url) => {
              // bumpPreview is required here: HeroLive only patches tagline +
              // names client-side, not the hero <Image>, so the iframe reload
              // is what actually shows the new photo. The postMessage is a
              // forward-looking no-op until HeroLive grows photo handling.
              updateWebsite.mutate({ heroPhotoUrl: url }, { onSuccess: bumpPreview })
            }}
            onScriptureClear={() => {
              updateWebsite.mutate({ scriptureText: null, scriptureReference: null, scriptureBackgroundColor: '' }, { onSuccess: bumpPreview })
            }}
            onFocalPointSave={(x, y) => {
              // bumpPreview is required here for the same reason as
              // onDefaultPhotoSelect: HeroLive does not patch the hero image
              // crop client-side, so the iframe reload is what actually shows
              // the new focal point. Without it the live preview only updated
              // after a manual refresh or tab switch (issue #182).
              updateWebsite.mutate({ heroFocalPointX: x, heroFocalPointY: y }, { onSuccess: bumpPreview })
            }}
            onTaglineColorSave={(color) => {
              updateWebsite.mutate({ heroTaglineColor: color })
            }}
            onTaglineColorLive={(color) => sendPreviewUpdate('heroTaglineColor', color)}
            onScriptureBgColorSave={(color) => {
              updateWebsite.mutate({ scriptureBackgroundColor: color }, { onSuccess: bumpPreview })
            }}
            onNameFontSave={(font) => {
              // No bumpPreview: the live postMessage below updates the preview hero
              // instantly (same pattern as the tagline color), so the couple sees the
              // font in the side-by-side preview without a full iframe reload.
              updateWebsite.mutate({ nameFont: font })
            }}
            onNameFontLive={(font) => sendPreviewUpdate('nameFont', font)}
          />
          <input
            ref={heroInputRef}
            type="file"
            accept={IMAGE_ACCEPT}
            className="hidden"
            onChange={handleHeroUpload}
          />

          {/* Tab bar: shows block counts as a badge */}
          <div className="border-b border-stone-200 flex items-stretch flex-shrink-0">
            <div className="flex overflow-x-auto flex-1">
              {BLOCK_TABS.map(t => {
                const count = blockCountByTab[t] ?? 0
                const isActive = activeTab === t
                return (
                  <button
                    key={t}
                    onClick={() => {
                      setActiveTab(t)
                      setPicking(false)
                      // Tab switch goes over postMessage (issue #310), not a
                      // full iframe reload. switchPreviewTab falls back to
                      // reloadPreview on its own if the preview never acks.
                      switchPreviewTab(t)
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
            {/* Settings drawer toggle: exposes per-tab hide/rename controls.
                Positioned on the right so it doesn't crowd the tabs themselves. */}
            <button
              onClick={() => setSettingsOpen(s => !s)}
              className={`px-3 border-l border-stone-200 inline-flex items-center gap-1 text-xs transition ${
                settingsOpen ? 'bg-stone-100 text-brown' : 'text-stone-500 hover:text-brown hover:bg-stone-50'
              }`}
              title="Hide or rename tabs"
              aria-expanded={settingsOpen}
            >
              <Settings2 size={12} />
              <span className="hidden sm:inline">Tabs</span>
            </button>
          </div>

          {/* Settings drawer: per-tab visibility + custom labels.
              Slides under the tab bar so it sits in context with the controls it edits. */}
          {settingsOpen && (
            <TabSettingsPanel
              website={website}
              onClose={() => setSettingsOpen(false)}
              onSave={(payload) => updateWebsite.mutate(payload, { onSuccess: bumpPreview })}
              onAccentColorSave={(color) => updateWebsite.mutate({ accentColor: color }, { onSuccess: bumpPreview })}
            />
          )}

          {/* Block list: also a drop target for picker drags. When a couple drags
              a block type from the picker and releases over this container, we
              decode the MIME and call create() with the matching type. */}
          <div
            className="flex-1 overflow-y-auto px-3 py-3"
            onDragOver={e => {
              if (e.dataTransfer.types.includes(PICKER_DRAG_TYPE)) {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'copy'
              }
            }}
            onDrop={e => {
              const type = e.dataTransfer.getData(PICKER_DRAG_TYPE) as BlockType
              if (!type) return
              e.preventDefault()
              handleAdd(type)
            }}
          >
            {blocksLoading || (backfill.isPending && blocks.length === 0) ? (
              <div className="flex items-center gap-2 text-sm text-stone-500 py-8 justify-center">
                <Loader2 className="animate-spin" size={14} />
                {backfill.isPending ? 'Setting up your page…' : 'Loading blocks…'}
              </div>
            ) : blocksForTab.length === 0 ? (
              // Empty tab: show picker if the user already clicked "Add your first block",
              // otherwise show the empty-state prompt. The BlockPicker CANNOT live in the
              // "has blocks" branch below: it would never render when the tab is empty.
              picking ? (
                <BlockPicker
                  tab={activeTab}
                  onPick={handleAdd}
                  onCancel={() => setPicking(false)}
                />
              ) : (
                <EmptyTabState
                  tab={activeTab}
                  onAdd={() => setPicking(true)}
                />
              )
            ) : (
              <SortableBlockList
                blocks={blocksForTab}
                onReorder={handleReorder}
                busy={reorder.isPending}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                defaultExpandedId={lastAddedBlockId}
              />
            )}

            {/* Add-block UI: only shown when the tab already has blocks */}
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

          {/* Footer hint about backfill: kept subtle */}
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

      {/* In-editor drawer for editing the data behind a card block. On close we
          bumpPreview so the iframe reflects any saved venue/hotel/registry edits. */}
      <AnimatePresence>
        {drawerSection && website && (
          <WebsiteSectionDrawer
            section={drawerSection}
            website={website}
            coupleId={coupleId}
            onClose={() => { setDrawerSection(null); bumpPreview() }}
          />
        )}
      </AnimatePresence>

      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        slug={website.slug}
        coupleNames={coupleNames}
      />
    </div>
    </BlockEditContext.Provider>
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

// Custom MIME used to tag picker drags so the list's drop handler can
// distinguish "create from picker" from any other browser drag (text/file).
const PICKER_DRAG_TYPE = 'application/x-altarwed-block-type'

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
        <div>
          <p className="text-xs font-semibold text-brown">Pick a block to add</p>
          <p className="text-[10px] text-stone-500">Click to add, or drag onto the list to drop in place.</p>
        </div>
        <button
          onClick={onCancel}
          className="text-xs text-stone-500 hover:text-stone-700"
        >
          Cancel
        </button>
      </div>
      {/* Each item is both clickable AND draggable. The drag carries the block
          TYPE in a custom MIME; the list's drop handler decodes it and calls
          create. We use native HTML5 drag rather than @dnd-kit here because the
          list already uses @dnd-kit for reorder: mixing two systems is fine,
          but using HTML5 keeps the picker's contract narrow (one direction:
          picker → list, no reorder semantics). */}
      <div className="grid grid-cols-1 gap-1.5">
        {ALLOWED_TYPES_PER_TAB[tab].map(type => (
          <button
            key={type}
            onClick={() => onPick(type)}
            draggable
            onDragStart={e => {
              e.dataTransfer.setData(PICKER_DRAG_TYPE, type)
              e.dataTransfer.effectAllowed = 'copy'
            }}
            title={BLOCK_TYPE_DESCRIPTIONS[type]}
            className="text-left px-3 py-2 rounded bg-white border border-stone-200 hover:border-gold hover:bg-amber-100/40 transition group cursor-grab active:cursor-grabbing"
          >
            <div className="text-xs font-semibold text-brown leading-tight">
              {BLOCK_TYPE_LABELS[type]}
            </div>
            <div className="text-[11px] text-stone-500 leading-snug mt-0.5 group-hover:text-stone-700 transition">
              {BLOCK_TYPE_DESCRIPTIONS[type]}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// Friendly per-tab hint shown in the empty state. Couples without context
// often don't know what each tab is supposed to contain: these one-liners
// reduce that friction.
const TAB_HINTS: Record<BlockTab, string> = {
  HOME: 'This is the landing page. Add a heading, your favorite scripture, or a countdown to your wedding day.',
  OUR_STORY: 'Tell your guests how you met, when you knew, and what God has done in your relationship.',
  DETAILS: 'Ceremony time, venue, dress code, what to expect: all the practical info your guests need.',
  WEDDING_PARTY: 'Add a grid for your bridesmaids and groomsmen. Pulls from the Wedding Party tab of the dashboard.',
  REGISTRY: 'Link to your registries. Add a registry block, then manage links with its edit button.',
  TRAVEL: 'Hotels, airports, and travel guidance for out-of-town guests.',
  PHOTOS: 'Add a photo album. Upload from the Photos tab of the dashboard, then it appears here.',
  RSVP: 'Show a call-to-action so guests RSVP. Add a countdown and a few details about the day.',
}

// ── Default hero photos ───────────────────────────────────────────────────────
// Self-hosted on Azure Blob (altarwed-media/defaults/hero/) so there is no
// dependency on Unsplash CDN availability or terms of service.
const HERO_BASE = 'https://altarwedprodstorage.blob.core.windows.net/altarwed-media/defaults/hero'
const DEFAULT_HERO_PHOTOS = [
  { label: 'Altar couple',  url: `${HERO_BASE}/altar-couple.jpg`  },
  { label: 'Church arch',   url: `${HERO_BASE}/church-arch.jpg`   },
  { label: 'Garden vows',   url: `${HERO_BASE}/garden-vows.jpg`   },
  { label: 'Sunset walk',   url: `${HERO_BASE}/sunset-walk.jpg`   },
  { label: 'Ring exchange', url: `${HERO_BASE}/ring-exchange.jpg` },
  { label: 'Chapel door',   url: `${HERO_BASE}/chapel-door.jpg`   },
]

// Debounced save hook: returns a `schedule(value)` callback that calls `persistedSave`
// 500ms after the most recent call. Used for any text field that wants
// type-to-save semantics without hammering the API on every keystroke.
// Lives at module scope (not inside a component) per the React Rules of Hooks.
// Couple-selectable fonts for the hero names. The `key` MUST stay in sync with the
// backend @Pattern on UpdateWeddingWebsiteRequest.nameFont and the public safeNameFont()
// allowlist; `label` is only what the couple sees in this picker.
const NAME_FONT_OPTIONS: { key: string; label: string }[] = [
  { key: 'playfair', label: 'Playfair (classic serif, default)' },
  { key: 'cinzel', label: 'Cinzel (engraved caps)' },
  { key: 'greatvibes', label: 'Great Vibes (formal script)' },
  { key: 'dancingscript', label: 'Dancing Script (handwritten)' },
  { key: 'montserrat', label: 'Montserrat (modern sans)' },
]

function useDebouncedSave<T>(persistedSave: (value: T) => void) {
  const timer = useRef<number | null>(null)
  const schedule = useCallback((value: T) => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => persistedSave(value), 500)
  }, [persistedSave])
  useEffect(() => {
    return () => { if (timer.current) window.clearTimeout(timer.current) }
  }, [])
  return schedule
}

// ── HeroSettings component ────────────────────────────────────────────────────
function HeroSettings({
  website,
  heroUploading,
  heroUploadError,
  onHeroErrorDismiss,
  onHeroUploadClick,
  onHeroDrop,
  onTaglineSave,
  onTaglineLive,
  onNameSave,
  onNameLive,
  onDefaultPhotoSelect,
  onScriptureClear,
  onFocalPointSave,
  onTaglineColorSave,
  onTaglineColorLive,
  onScriptureBgColorSave,
  onNameFontSave,
  onNameFontLive,
}: {
  website: {
    heroPhotoUrl?: string | null
    heroTagline?: string | null
    heroFocalPointX?: number | null
    heroFocalPointY?: number | null
    heroTaglineColor?: string | null
    partnerOneName?: string
    partnerTwoName?: string
    scriptureReference?: string | null
    scriptureText?: string | null
    scriptureBackgroundColor?: string | null
    nameFont?: string | null
  }
  websiteId: string
  heroUploading: boolean
  heroUploadError: string | null
  onHeroErrorDismiss: () => void
  onHeroUploadClick: () => void
  onHeroDrop: (file: File) => void | Promise<void>
  onTaglineSave: (tagline: string) => void
  onTaglineLive: (tagline: string) => void
  onNameSave: (field: 'partnerOneName' | 'partnerTwoName', value: string) => void
  onNameLive: (field: 'partnerOneName' | 'partnerTwoName', value: string) => void
  onDefaultPhotoSelect: (url: string) => void
  onScriptureClear: () => void
  onFocalPointSave: (x: number, y: number) => void
  onTaglineColorSave: (color: string | null) => void
  onTaglineColorLive: (color: string) => void
  onScriptureBgColorSave: (color: string) => void
  onNameFontSave: (font: string | null) => void
  onNameFontLive: (font: string) => void
}) {
  const DEFAULT_TAGLINE = 'Together in covenant'
  const [expanded, setExpanded] = useState(false)
  const [tagline, setTagline] = useState(website.heroTagline ?? DEFAULT_TAGLINE)
  const [taglineColor, setTaglineColor] = useState<string>(website.heroTaglineColor ?? '#ffffff')
  const [focalPointX, setFocalPointX] = useState<number>(website.heroFocalPointX ?? 0.5)
  const [focalPointY, setFocalPointY] = useState<number>(website.heroFocalPointY ?? 0.5)
  const [brideName, setBrideName] = useState(website.partnerTwoName ?? '')
  const [groomName, setGroomName] = useState(website.partnerOneName ?? '')
  const [nameFont, setNameFont] = useState<string>(website.nameFont ?? 'playfair')
  const [pickingPhoto, setPickingPhoto] = useState(false)
  const [photoDragOver, setPhotoDragOver] = useState(false)

  // Sync local state if the website record refreshes (e.g. another tab edited it)
  useEffect(() => { setTagline(website.heroTagline ?? DEFAULT_TAGLINE) }, [website.heroTagline])
  useEffect(() => { setTaglineColor(website.heroTaglineColor ?? '#ffffff') }, [website.heroTaglineColor])
  useEffect(() => { setFocalPointX(website.heroFocalPointX ?? 0.5) }, [website.heroFocalPointX])
  useEffect(() => { setFocalPointY(website.heroFocalPointY ?? 0.5) }, [website.heroFocalPointY])
  useEffect(() => { setBrideName(website.partnerTwoName ?? '') }, [website.partnerTwoName])
  useEffect(() => { setGroomName(website.partnerOneName ?? '') }, [website.partnerOneName])
  useEffect(() => { setNameFont(website.nameFont ?? 'playfair') }, [website.nameFont])

  const scheduleTaglineSave = useDebouncedSave(onTaglineSave)
  const scheduleBrideSave   = useDebouncedSave((v: string) => onNameSave('partnerTwoName', v))
  const scheduleGroomSave   = useDebouncedSave((v: string) => onNameSave('partnerOneName', v))
  const scheduleTaglineColorSave = useDebouncedSave((v: string) => onTaglineColorSave(v))

  const [scriptureBgColor, setScriptureBgColor] = useState<string>(website.scriptureBackgroundColor ?? '')
  useEffect(() => { setScriptureBgColor(website.scriptureBackgroundColor ?? '') }, [website.scriptureBackgroundColor])
  const scheduleScriptureBgColorSave = useDebouncedSave((v: string) => onScriptureBgColorSave(v))

  return (
    <div className="border-b-2 border-gold-light flex-shrink-0 bg-gradient-to-r from-ivory via-white to-ivory">
      {/* Collapsed summary row: whole row is one button so the thumb, label,
          and chevron share a single click target with keyboard + focus support.
          Styled prominently because the hero is the first thing guests see and
          couples need to spot the editing affordance immediately. */}
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        aria-expanded={expanded}
        className="w-full px-3 py-3 flex items-center gap-3 text-left hover:bg-gold-light/20 focus-visible:ring-2 focus-visible:ring-gold focus:outline-none transition-colors group"
      >
        <span className="w-16 h-12 rounded-md overflow-hidden border border-gold-light flex-shrink-0 bg-stone-200 flex items-center justify-center shadow-sm">
          {website.heroPhotoUrl
            ? <img src={website.heroPhotoUrl} alt="" className="w-full h-full object-cover" />
            : <ImagePlus size={18} className="text-stone-400" />
          }
        </span>
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-brown leading-tight mb-0.5">
            <Pencil size={12} className="text-gold flex-shrink-0" />
            Hero photo &amp; tagline
            {!expanded && (
              <span className="text-[10px] font-normal text-gold uppercase tracking-wider ml-1 group-hover:underline">
                Click to edit
              </span>
            )}
          </span>
          <span className="block text-xs text-brown-light leading-snug truncate">
            {website.heroTagline === ''
              ? <span className="italic">(no tagline: hidden on the live site)</span>
              : (website.heroTagline || <span className="italic">&ldquo;Together in covenant&rdquo; (default)</span>)}
          </span>
        </span>
        <span className="text-xs text-brown-light flex-shrink-0" aria-hidden="true">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>

      {/* Expanded editor */}
      {expanded && (
        <div className="overflow-y-auto max-h-[400px] px-3 pb-3 space-y-3 border-t border-stone-100 pt-3">
          {/* Tagline */}
          <div>
            <label htmlFor="hero-tagline" className="block text-[10px] font-semibold text-stone-500 uppercase tracking-wide mb-1">
              Tagline (shown over the photo)
            </label>
            <input
              id="hero-tagline"
              type="text"
              value={tagline}
              onChange={e => {
                const v = e.target.value
                setTagline(v)
                onTaglineLive(v)       // live preview update via postMessage
                scheduleTaglineSave(v) // debounced persisted save
              }}
              onBlur={() => onTaglineSave(tagline)}
              maxLength={200}
              className="w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="text-[10px] text-stone-400 leading-snug">
                Edit to customize, or clear to hide the tagline entirely.
              </p>
              <button
                type="button"
                onClick={() => {
                  setTagline('')
                  onTaglineLive('')
                  onTaglineSave('')
                }}
                className="text-[10px] text-amber-700 hover:text-amber-900 underline shrink-0"
                title="Clear the tagline so nothing shows above your names"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Tagline color */}
          <div className="flex items-center gap-2">
            <label htmlFor="hero-tagline-color" className="text-[10px] font-semibold text-stone-500 uppercase tracking-wide flex-1">
              Tagline color
            </label>
            <input
              id="hero-tagline-color"
              type="color"
              value={taglineColor}
              onChange={e => {
                const v = e.target.value
                setTaglineColor(v)
                onTaglineColorLive(v)
                scheduleTaglineColorSave(v)
              }}
              onBlur={() => onTaglineColorSave(taglineColor)}
              className="h-6 w-12 rounded border border-stone-300 cursor-pointer p-0.5"
            />
            <button
              type="button"
              onClick={() => {
                setTaglineColor('#ffffff')
                onTaglineColorSave(null)
              }}
              className="text-[10px] text-stone-400 hover:text-stone-700 underline"
              title="Reset to default white"
            >
              Reset
            </button>
          </div>

          {/* Bride + Groom names: bride first per display convention */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="hero-bride-name" className="block text-[10px] font-semibold text-stone-500 uppercase tracking-wide mb-1">
                Bride
              </label>
              <input
                id="hero-bride-name"
                type="text"
                value={brideName}
                onChange={e => {
                  const v = e.target.value
                  setBrideName(v)
                  onNameLive('partnerTwoName', v)
                  scheduleBrideSave(v)
                }}
                onBlur={() => onNameSave('partnerTwoName', brideName)}
                maxLength={100}
                className="w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
            </div>
            <div>
              <label htmlFor="hero-groom-name" className="block text-[10px] font-semibold text-stone-500 uppercase tracking-wide mb-1">
                Groom
              </label>
              <input
                id="hero-groom-name"
                type="text"
                value={groomName}
                onChange={e => {
                  const v = e.target.value
                  setGroomName(v)
                  onNameLive('partnerOneName', v)
                  scheduleGroomSave(v)
                }}
                onBlur={() => onNameSave('partnerOneName', groomName)}
                maxLength={100}
                className="w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
            </div>
            <p className="col-span-2 text-[10px] text-stone-400 leading-snug -mt-1">
              Updates live. Both names appear on every public page header.
            </p>
          </div>

          {/* Names font: sets the typeface for the couple's names in the hero.
              Saves + refreshes the preview (no live postMessage, same as accent color). */}
          <div>
            <label htmlFor="hero-name-font" className="block text-[10px] font-semibold text-stone-500 uppercase tracking-wide mb-1">
              Names font
            </label>
            <select
              id="hero-name-font"
              value={nameFont}
              onChange={e => {
                const v = e.target.value
                setNameFont(v)
                onNameFontLive(v)   // instant preview update (postMessage to the iframe)
                // Always send the literal key (incl. "playfair"). Sending null for the default
                // would hit the backend patch-merge's "null = no change" branch, so a couple
                // could never switch BACK to Playfair once they picked another font.
                onNameFontSave(v)
              }}
              className="w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-xs bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              {NAME_FONT_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
            <p className="mt-1 text-[10px] text-stone-400 leading-snug">
              Sets the font for your names on the public site.
            </p>
          </div>

          {/* Photo actions */}
          <div>
            <label className="block text-[10px] font-semibold text-stone-500 uppercase tracking-wide mb-2">
              Hero photo
            </label>
            {/* Drop zone wraps both the upload button and the default-photo grid so
                a couple can drag a photo from their desktop straight onto the hero
                area. Same endpoint as the click-to-upload flow. */}
            <div
              onDragOver={e => {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'copy'
                if (!photoDragOver) setPhotoDragOver(true)
              }}
              onDragLeave={() => setPhotoDragOver(false)}
              onDrop={e => {
                e.preventDefault()
                setPhotoDragOver(false)
                const file = e.dataTransfer.files?.[0]
                if (file) onHeroDrop(file)
              }}
              className={`rounded transition ${photoDragOver ? 'ring-2 ring-amber-500 ring-offset-2 ring-offset-stone-50' : ''}`}
            >
            <div className="flex gap-2 mb-2">
              <button
                onClick={onHeroUploadClick}
                disabled={heroUploading}
                className="flex-1 text-xs px-2.5 py-1.5 rounded border border-stone-300 bg-white hover:border-gold hover:text-brown transition text-stone-600 disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {heroUploading
                  ? <><Loader2 size={11} className="animate-spin" /> Uploading…</>
                  : photoDragOver
                  ? <><ImagePlus size={11} /> Drop to upload</>
                  : <><ImagePlus size={11} /> Upload or drop a photo</>
                }
              </button>
              <button
                onClick={() => setPickingPhoto(p => !p)}
                className="flex-1 text-xs px-2.5 py-1.5 rounded border border-stone-300 bg-white hover:border-gold hover:text-brown transition text-stone-600 flex items-center justify-center gap-1"
              >
                {pickingPhoto ? 'Cancel' : 'Choose default'}
              </button>
            </div>

            {heroUploadError && (
              <div role="alert" className="flex items-start gap-1.5 mt-1 mb-1 text-[10px] text-red-700 leading-snug bg-red-50 border border-red-200 rounded px-2 py-1.5">
                <span className="flex-1">{heroUploadError}</span>
                <button onClick={onHeroErrorDismiss} aria-label="Dismiss" className="text-red-400 hover:text-red-700 flex-shrink-0 leading-none"><X size={12} /></button>
              </div>
            )}
            <p className="text-[10px] text-stone-400 leading-snug mb-2">
              A wide landscape photo works best. Tall portrait shots get cropped top and bottom in the banner.
            </p>

            {/* Default photo grid */}
            {pickingPhoto && (
              <div className="grid grid-cols-3 gap-1.5">
                {DEFAULT_HERO_PHOTOS.map(photo => (
                  <button
                    key={photo.url}
                    onClick={() => {
                      onDefaultPhotoSelect(photo.url)
                      setPickingPhoto(false)
                    }}
                    className="relative aspect-video rounded overflow-hidden border-2 border-transparent hover:border-gold transition group"
                    title={photo.label}
                  >
                    <img src={`${photo.url.split('?')[0]}?w=200&q=60`} alt={photo.label} className="w-full h-full object-cover" />
                    <span className="absolute inset-0 flex items-end justify-center pb-1 opacity-0 group-hover:opacity-100 bg-black/30 text-white text-[9px] transition">
                      {photo.label}
                    </span>
                  </button>
                ))}
              </div>
            )}
            </div>
            <p className="mt-1.5 text-[10px] text-stone-400 leading-snug">
              JPEG, PNG, or WebP. Up to {MAX_UPLOAD_LABEL}.
            </p>
          </div>

          {/* Focal point picker: shows only when a hero photo is set */}
          {website.heroPhotoUrl && (
            <div>
              <label className="block text-[10px] font-semibold text-stone-500 uppercase tracking-wide mb-1">
                Crop position
              </label>
              <p className="text-[10px] text-stone-400 leading-snug mb-1.5">
                Click anywhere on the photo to set what part stays centered in the banner.
              </p>
              <div
                className="relative aspect-video rounded overflow-hidden border border-stone-200 cursor-crosshair"
                role="button"
                tabIndex={0}
                aria-label="Focal point picker. Click, or use the arrow keys, to set what part of the photo stays centered. Press Enter to recenter."
                onClick={e => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
                  const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
                  setFocalPointX(x)
                  setFocalPointY(y)
                  onFocalPointSave(x, y)
                }}
                onKeyDown={e => {
                  // Keyboard users could not previously set a point: Enter/Space
                  // only snapped back to center. Arrow keys now nudge the focal
                  // point in 5% steps so it is fully operable without a mouse.
                  const STEP = 0.05
                  let x = focalPointX
                  let y = focalPointY
                  switch (e.key) {
                    case 'ArrowLeft': x = Math.max(0, focalPointX - STEP); break
                    case 'ArrowRight': x = Math.min(1, focalPointX + STEP); break
                    case 'ArrowUp': y = Math.max(0, focalPointY - STEP); break
                    case 'ArrowDown': y = Math.min(1, focalPointY + STEP); break
                    case 'Enter':
                    case ' ':
                      x = 0.5
                      y = 0.5
                      break
                    default:
                      return
                  }
                  // Prevent the page from scrolling on arrow/space while focused.
                  e.preventDefault()
                  setFocalPointX(x)
                  setFocalPointY(y)
                  onFocalPointSave(x, y)
                }}
              >
                <img
                  src={website.heroPhotoUrl}
                  alt=""
                  className="w-full h-full object-cover"
                  style={{ objectPosition: `${focalPointX * 100}% ${focalPointY * 100}%` }}
                />
                {/* Crosshair dot at current focal point */}
                <div
                  className="absolute w-4 h-4 border-2 border-white bg-black/20 rounded-full -translate-x-1/2 -translate-y-1/2 shadow pointer-events-none"
                  style={{ left: `${focalPointX * 100}%`, top: `${focalPointY * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Wedding scripture */}
          <div>
            <label className="block text-[10px] font-semibold text-stone-500 uppercase tracking-wide mb-1.5">
              Wedding scripture
            </label>
            {(website.scriptureReference || website.scriptureText) ? (
              <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  {website.scriptureReference && (
                    <p className="text-xs font-medium text-brown truncate">{website.scriptureReference}</p>
                  )}
                  {website.scriptureText && (
                    <p className="text-[11px] text-stone-500 leading-snug line-clamp-2 mt-0.5">
                      &ldquo;{website.scriptureText}&rdquo;
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onScriptureClear}
                  className="shrink-0 text-xs border border-red-300 text-red-500 hover:bg-red-50 hover:text-red-700 rounded px-2 py-0.5 transition"
                  title="Remove the scripture banner from your public page"
                >
                  Remove verse
                </button>
              </div>
            ) : (
              <p className="text-[10px] text-stone-400 leading-snug">
                No verse selected. Browse and set one in the{' '}
                <Link to="/dashboard/scripture" className="text-amber-700 underline hover:text-amber-900">
                  Scripture tab
                </Link>
                . Not using a verse? This section is hidden from your page when empty.
              </p>
            )}
            {(website.scriptureReference || website.scriptureText) && (
              <div className="mt-2">
                <label className="block text-[10px] font-semibold text-stone-500 uppercase tracking-wide mb-1">
                  Banner background color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="scripture-bg-color"
                    type="color"
                    value={scriptureBgColor || '#3b2f2f'}
                    onChange={e => {
                      const v = e.target.value
                      setScriptureBgColor(v)
                      scheduleScriptureBgColorSave(v)
                    }}
                    onBlur={() => { if (scriptureBgColor !== (website.scriptureBackgroundColor ?? '')) onScriptureBgColorSave(scriptureBgColor) }}
                    className="h-6 w-12 rounded border border-stone-300 cursor-pointer p-0.5"
                  />
                  <button
                    type="button"
                    onClick={() => { setScriptureBgColor(''); onScriptureBgColorSave('') }}
                    className="text-xs text-stone-400 hover:text-stone-600"
                  >
                    Reset to default
                  </button>
                </div>
                <p className="text-[10px] text-stone-400 mt-1 leading-snug">Default is the dark gradient.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── TabSettingsPanel ──────────────────────────────────────────────────────────
// Per-tab visibility + custom-label overrides. Backed by two opaque strings on
// the wedding website record (hiddenTabs CSV + customTabLabels JSON). Parses on
// open, builds the same shape on save. Doesn't try to live-preview these because
// the tab nav is rendered server-side; the iframe reloads after save and the
// new labels/visibility apply on the next render.
const DEFAULT_TAB_DISPLAY: Record<BlockTab, string> = {
  HOME: 'Home',
  OUR_STORY: 'Our Story',
  DETAILS: 'The Wedding',
  WEDDING_PARTY: 'Wedding Party',
  REGISTRY: 'Registry',
  TRAVEL: 'Travel',
  PHOTOS: 'Photos',
  RSVP: 'RSVP',
}

function TabSettingsPanel({
  website,
  onClose,
  onSave,
  onAccentColorSave,
}: {
  website: WeddingWebsite
  onClose: () => void
  onSave: (payload: { hiddenTabs: string; customTabLabels: string }) => void
  onAccentColorSave: (color: string | null) => void
}) {
  const [saving, setSaving] = useState(false)
  const [accentColor, setAccentColor] = useState(website.accentColor ?? '#d4af6a')
  const scheduleAccentSave = useDebouncedSave((v: string) => onAccentColorSave(v))
  // Parse the opaque server fields on open. Re-derived from props rather than
  // memoised because the panel is short-lived and re-parsing is trivially cheap.
  const initialHidden = new Set<BlockTab>(
    (website.hiddenTabs ?? '').split(',').map(s => s.trim()).filter(Boolean) as BlockTab[]
  )
  // parseTabLabels strips the reserved __theme key so the tab-label editor only manages
  // real tab labels; the theme is tracked separately in themeKey below.
  const initialLabels = parseTabLabels(website.customTabLabels) as Partial<Record<BlockTab, string>>

  const [hidden, setHidden] = useState<Set<BlockTab>>(initialHidden)
  const [labels, setLabels] = useState<Partial<Record<BlockTab, string>>>(initialLabels)
  // Font-pairing theme (issue #358), stored alongside the tab labels in the same opaque
  // customTabLabels column under the reserved __theme key.
  const [themeKey, setThemeKey] = useState<string>(readFontThemeKey(website.customTabLabels))

  const toggleHidden = (tab: BlockTab) => {
    setHidden(prev => {
      const next = new Set(prev)
      if (next.has(tab)) next.delete(tab); else next.add(tab)
      return next
    })
  }
  const setLabel = (tab: BlockTab, value: string) => {
    setLabels(prev => {
      const next = { ...prev }
      if (value.trim()) next[tab] = value
      else delete next[tab]
      return next
    })
  }

  const handleSave = () => {
    if (saving) return // guard against rapid double-click firing two mutations
    setSaving(true)
    // Sort the hidden CSV deterministically so two equivalent saves produce
    // identical strings (cleaner audit logs, predictable cache keys).
    const hiddenCsv = Array.from(hidden).sort().join(',')
    // serializeTabLabels merges the tab labels and the chosen font theme back into the
    // single opaque customTabLabels string so neither clobbers the other.
    const labelsJson = serializeTabLabels(labels as Record<string, string>, themeKey)
    onSave({ hiddenTabs: hiddenCsv, customTabLabels: labelsJson })
    onClose()
  }

  return (
    <div className="border-b border-stone-200 bg-stone-50 px-4 py-3 max-h-64 overflow-y-auto">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="text-xs font-semibold text-brown">Customise your tabs</p>
          <p className="text-[11px] text-stone-500 leading-snug">
            Hide tabs you don&apos;t need, or rename them. Home and RSVP are always visible to your guests.
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-stone-400 hover:text-stone-700 text-lg leading-none -mt-0.5"
          aria-label="Close tabs panel"
        >
          <X size={18} />
        </button>
      </div>
      <ul className="space-y-1.5">
        {BLOCK_TABS.map(tab => {
          // HOME and RSVP are core navigation surfaces: couples can rename them
          // but cannot hide them entirely (a guest landing on /wedding/[slug]
          // without a Home tab would be confused, and RSVP is the whole point).
          const isCore = tab === 'HOME' || tab === 'RSVP'
          const isHidden = hidden.has(tab)
          return (
            <li key={tab} className={`flex items-center gap-2 rounded border bg-white px-2.5 py-1.5 ${isHidden ? 'border-stone-200 opacity-60' : 'border-stone-200'}`}>
              <label className={`flex items-center gap-1.5 text-[11px] shrink-0 ${isCore ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
                <input
                  type="checkbox"
                  checked={!isHidden}
                  disabled={isCore}
                  onChange={() => toggleHidden(tab)}
                  className="accent-amber-600"
                />
                <span className="font-medium text-brown w-20">{DEFAULT_TAB_DISPLAY[tab]}</span>
              </label>
              <input
                type="text"
                value={labels[tab] ?? ''}
                onChange={e => setLabel(tab, e.target.value)}
                placeholder={`Default: ${DEFAULT_TAB_DISPLAY[tab]}`}
                maxLength={40}
                className="flex-1 rounded border border-stone-300 px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
            </li>
          )
        })}
      </ul>
      {/* Accent color: immediate-save (no Save button needed) */}
      <div className="mt-3 rounded border border-stone-200 bg-white px-2.5 py-2">
        <p className="text-[11px] font-medium text-brown mb-1.5">Accent color</p>
        {/* Curated preset swatches: one-click, keyboard-accessible choices that
            keep couples on legible, on-brand colours. The custom picker below
            still lets them fine-tune any hex. */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          {ACCENT_PRESETS.map(preset => {
            const isSelected = isAccentPresetSelected(accentColor, preset.hex)
            return (
              <button
                key={preset.hex}
                type="button"
                onClick={() => {
                  setAccentColor(preset.hex)
                  onAccentColorSave(preset.hex)
                }}
                aria-label={`Use ${preset.name} accent color`}
                aria-pressed={isSelected}
                title={preset.name}
                style={{ backgroundColor: preset.hex }}
                className={`h-6 w-6 rounded-full border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-amber-500 ${
                  isSelected
                    ? 'border-brown ring-2 ring-offset-1 ring-brown'
                    : 'border-stone-300 hover:scale-110'
                }`}
              />
            )
          })}
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="accent-color" className="text-[11px] text-stone-500 flex-1">
            Or pick a custom color
          </label>
          <input
            id="accent-color"
            type="color"
            value={accentColor}
            onChange={e => {
              const v = e.target.value
              setAccentColor(v)
              scheduleAccentSave(v)
            }}
            onBlur={() => onAccentColorSave(accentColor)}
            className="h-6 w-12 rounded border border-stone-300 cursor-pointer p-0.5"
          />
          <button
            type="button"
            onClick={() => {
              setAccentColor('#d4af6a')
              onAccentColorSave(null)
            }}
            className="text-[10px] text-stone-400 hover:text-stone-700 underline"
            title="Reset to default gold"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Font-pairing theme (issue #358): a curated heading + body pairing for the
          whole public site. Applied after Save (like the tab labels) because the
          fonts are rendered server-side in the wedding layout. */}
      <fieldset className="mt-3 rounded border border-stone-200 bg-white px-2.5 py-2">
        <legend className="text-[11px] font-medium text-brown px-1">Font theme</legend>
        <div className="space-y-1">
          {FONT_THEME_OPTIONS.map(option => {
            const isSelected = themeKey === option.key
            return (
              <label
                key={option.key}
                className={`flex items-start gap-2 rounded border px-2 py-1.5 cursor-pointer transition ${
                  isSelected ? 'border-brown bg-stone-50' : 'border-stone-200 hover:border-stone-300'
                }`}
              >
                <input
                  type="radio"
                  name="font-theme"
                  value={option.key}
                  checked={isSelected}
                  onChange={() => setThemeKey(option.key)}
                  className="mt-0.5 accent-amber-600"
                />
                <span className="min-w-0">
                  <span className="block text-[11px] font-medium text-brown leading-tight">{option.label}</span>
                  <span className="block text-[10px] text-stone-500 leading-snug">{option.description}</span>
                </span>
              </label>
            )
          })}
        </div>
      </fieldset>

      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-[10px] text-stone-400 leading-snug">
          Changes apply after Save. The preview will reload to reflect them.
        </p>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded bg-gold text-white text-xs font-medium px-3 py-1.5 hover:bg-gold-dark disabled:opacity-50 transition"
        >
          {saving ? 'Saving…' : 'Save tabs'}
        </button>
      </div>
    </div>
  )
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
