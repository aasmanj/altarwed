import { useMemo, useState } from 'react'
import { useAuth } from '@/core/auth/AuthContext'
import PageHeader from '@/components/PageHeader'
import { Plus, RefreshCw } from 'lucide-react'
import { useWeddingWebsite } from '../useWeddingWebsite'
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

// Side-by-side editor: live public-site preview on the left, block CRUD on the
// right. Phase 1 / Checkpoint 3 — iframe currently points at the published
// public page; draft preview (signed token + /preview/[slug]) is Checkpoint 4.
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

  const [activeTab, setActiveTab] = useState<BlockTab>('HOME')
  const [picking, setPicking] = useState(false)
  const [previewKey, setPreviewKey] = useState(0)

  const blocksForTab = useMemo(
    () => blocks.filter(b => b.tab === activeTab).sort((a, b) => a.sortOrder - b.sortOrder),
    [blocks, activeTab],
  )

  if (websiteLoading || !website) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-brown-light text-sm animate-pulse">Loading…</p>
      </div>
    )
  }
  if (!websiteId) return null

  const publicTabPath = TAB_TO_PUBLIC_PATH[activeTab]
  const previewUrl = website.isPublished
    ? `https://www.altarwed.com/wedding/${website.slug}${publicTabPath}`
    : null

  const handleAdd = (type: BlockType) => {
    setPicking(false)
    create.mutate(
      { tab: activeTab, type, contentJson: defaultContentJson(type) },
      { onSuccess: () => setPreviewKey(k => k + 1) },
    )
  }
  const handleUpdate = (blockId: string, contentJson: string) =>
    update.mutate({ blockId, contentJson }, { onSuccess: () => setPreviewKey(k => k + 1) })
  const handleDelete = (blockId: string) =>
    remove.mutate(blockId, { onSuccess: () => setPreviewKey(k => k + 1) })
  const handleReorder = (orderedBlockIds: string[]) =>
    reorder.mutate({ tab: activeTab, orderedBlockIds })

  return (
    <div>
      <PageHeader
        title="Page Builder"
        subtitle="Drag blocks to reorder. Edit content inline."
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => backfill.mutate()}
              disabled={backfill.isPending}
              className="text-xs text-stone-600 hover:text-stone-900 inline-flex items-center gap-1 disabled:opacity-50"
              title="Seed blocks from your existing wedding website fields"
            >
              <RefreshCw size={12} /> {backfill.isPending ? 'Seeding…' : 'Seed from fields'}
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4 px-4 py-4 h-[calc(100vh-7rem)]">
        {/* Left: preview iframe */}
        <div className="rounded-xl border border-stone-200 bg-stone-50 overflow-hidden flex flex-col">
          <div className="px-3 py-1.5 text-xs text-stone-500 border-b border-stone-200 flex items-center justify-between">
            <span className="truncate">{previewUrl ?? 'Draft — publish to preview'}</span>
            {previewUrl && (
              <button
                onClick={() => setPreviewKey(k => k + 1)}
                className="text-stone-600 hover:text-stone-900 inline-flex items-center gap-1"
              >
                <RefreshCw size={11} /> Refresh
              </button>
            )}
          </div>
          {previewUrl ? (
            <iframe
              key={previewKey}
              src={previewUrl}
              title="Wedding website preview"
              className="flex-1 w-full bg-white"
            />
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-center">
              <div>
                <p className="text-stone-700 font-medium">Your site is in draft.</p>
                <p className="text-stone-500 text-sm mt-1">
                  Publish from the classic editor to enable live preview here.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right: block list */}
        <div className="rounded-xl border border-stone-200 bg-white flex flex-col overflow-hidden">
          {/* Tab bar */}
          <div className="border-b border-stone-200 overflow-x-auto">
            <div className="flex">
              {BLOCK_TABS.map(t => (
                <button
                  key={t}
                  onClick={() => {
                    setActiveTab(t)
                    setPreviewKey(k => k + 1)
                  }}
                  className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition ${
                    activeTab === t
                      ? 'border-amber-500 text-stone-900'
                      : 'border-transparent text-stone-500 hover:text-stone-800'
                  }`}
                >
                  {BLOCK_TAB_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {blocksLoading ? (
              <p className="text-sm text-stone-500 animate-pulse">Loading…</p>
            ) : (
              <SortableBlockList
                blocks={blocksForTab}
                onReorder={handleReorder}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
              />
            )}

            <div className="mt-3">
              {picking ? (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-2">
                  <p className="text-xs font-medium text-stone-700 mb-2">Choose a block to add</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {ALLOWED_TYPES_PER_TAB[activeTab].map(type => (
                      <button
                        key={type}
                        onClick={() => handleAdd(type)}
                        className="text-left text-xs px-2 py-1.5 rounded bg-white border border-stone-200 hover:border-amber-400 hover:bg-amber-50"
                      >
                        {BLOCK_TYPE_LABELS[type]}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setPicking(false)}
                    className="text-xs text-stone-500 hover:text-stone-700 mt-2"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setPicking(true)}
                  className="w-full inline-flex items-center justify-center gap-1 rounded-lg border-2 border-dashed border-stone-300 hover:border-amber-400 hover:bg-amber-50 px-3 py-2 text-sm text-stone-600"
                >
                  <Plus size={14} /> Add block
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Mapping from BlockTab to the path segment under /wedding/[slug]. The HOME tab
// renders at the root of the wedding site (no suffix); others map to their
// existing public sub-routes.
const TAB_TO_PUBLIC_PATH: Record<BlockTab, string> = {
  HOME: '',
  OUR_STORY: '/story',
  DETAILS: '/details',
  WEDDING_PARTY: '/wedding-party',
  REGISTRY: '/registry',
  TRAVEL: '/travel',
  PHOTOS: '/photos',
  RSVP: '/rsvp',
}
