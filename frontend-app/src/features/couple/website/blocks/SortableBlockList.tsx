import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, ChevronUp, Trash2 } from 'lucide-react'
import BlockForm from './BlockForm'
import { useConfirm } from '@/components/ConfirmDialog'
import { BLOCK_TYPE_LABELS, type WeddingPageBlock } from './types'

interface Props {
  blocks: WeddingPageBlock[]
  onReorder: (orderedIds: string[]) => void
  onUpdate: (blockId: string, contentJson: string) => void
  onDelete: (blockId: string) => void
  // True while a reorder mutation is in flight; gates the arrows (issue #305).
  busy: boolean
  defaultExpandedId?: string | null
}

export default function SortableBlockList({ blocks, onReorder, onUpdate, onDelete, busy, defaultExpandedId }: Props) {
  const moveUp = (index: number) => {
    if (index <= 0) return
    const ids = blocks.map(b => b.id)
    ;[ids[index - 1], ids[index]] = [ids[index], ids[index - 1]]
    onReorder(ids)
  }

  const moveDown = (index: number) => {
    if (index >= blocks.length - 1) return
    const ids = blocks.map(b => b.id)
    ;[ids[index], ids[index + 1]] = [ids[index + 1], ids[index]]
    onReorder(ids)
  }

  if (blocks.length === 0) {
    return (
      <p className="text-sm text-stone-500 italic py-6 text-center">
        No blocks on this tab yet. Add one to get started.
      </p>
    )
  }

  return (
    <ul className="space-y-2">
      {blocks.map((block, index) => (
        <BlockRow
          key={block.id}
          block={block}
          isFirst={index === 0}
          isLast={index === blocks.length - 1}
          // Disable every row's arrows while a reorder is in flight. Combined with the
          // cancelQueries in useReorderBlocks' onMutate, this serializes clicks so two
          // PATCHes can't race and have an out-of-order arrival land a stale order
          // (same fix as the wedding-party reorder, WeddingPartyManager).
          busy={busy}
          initiallyExpanded={defaultExpandedId === block.id}
          onMoveUp={() => moveUp(index)}
          onMoveDown={() => moveDown(index)}
          onUpdate={contentJson => onUpdate(block.id, contentJson)}
          onDelete={() => onDelete(block.id)}
        />
      ))}
    </ul>
  )
}

function BlockRow({
  block,
  isFirst,
  isLast,
  busy,
  onMoveUp,
  onMoveDown,
  onUpdate,
  onDelete,
  initiallyExpanded = false,
}: {
  block: WeddingPageBlock
  isFirst: boolean
  isLast: boolean
  busy: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onUpdate: (contentJson: string) => void
  onDelete: () => void
  initiallyExpanded?: boolean
}) {
  const confirm = useConfirm()
  const [open, setOpen] = useState(initiallyExpanded)

  useEffect(() => {
    if (initiallyExpanded) setOpen(true)
  }, [initiallyExpanded])

  return (
    <li className="bg-white border border-stone-200 rounded-lg">
      <div className="flex items-center gap-1 px-2 py-2">
        {/* Up/down reorder arrows */}
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isFirst || busy}
            className="p-0.5 text-stone-400 hover:text-stone-700 disabled:opacity-20 disabled:cursor-default"
            aria-label="Move block up"
          >
            <ChevronUp size={14} />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast || busy}
            className="p-0.5 text-stone-400 hover:text-stone-700 disabled:opacity-20 disabled:cursor-default"
            aria-label="Move block down"
          >
            <ChevronDown size={14} />
          </button>
        </div>

        <button
          onClick={() => setOpen(o => !o)}
          className="flex-1 flex items-center gap-2 text-left text-sm font-medium text-stone-700 hover:text-stone-900 min-w-0"
        >
          {open ? <ChevronDown size={14} className="shrink-0" /> : <ChevronRight size={14} className="shrink-0" />}
          <span className="truncate">{BLOCK_TYPE_LABELS[block.type]}</span>
        </button>

        <button
          onClick={async () => {
            if (await confirm({
              title: `Delete this ${BLOCK_TYPE_LABELS[block.type].toLowerCase()} block?`,
              message: 'This section will be removed from your wedding website.',
              tone: 'danger',
              confirmLabel: 'Delete',
            })) onDelete()
          }}
          className="p-1 text-stone-400 hover:text-red-600"
          aria-label="Delete block"
        >
          <Trash2 size={14} />
        </button>
      </div>
      {open && (
        <div className="px-4 pb-3 border-t border-stone-100 pt-3">
          <BlockForm block={block} onSave={onUpdate} />
        </div>
      )}
    </li>
  )
}
