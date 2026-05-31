import { useEffect, useState } from 'react'
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronDown, ChevronRight, GripVertical, Trash2 } from 'lucide-react'
import BlockForm from './BlockForm'
import { useConfirm } from '@/components/ConfirmDialog'
import { BLOCK_TYPE_LABELS, type WeddingPageBlock } from './types'

interface Props {
  blocks: WeddingPageBlock[]
  onReorder: (orderedIds: string[]) => void
  onUpdate: (blockId: string, contentJson: string) => void
  onDelete: (blockId: string) => void
  // If provided, the row with this id renders expanded on first mount so the
  // couple can start editing the just-added block immediately. Pattern: caller
  // sets this to the new block id after a successful create.
  defaultExpandedId?: string | null
}

export default function SortableBlockList({ blocks, onReorder, onUpdate, onDelete, defaultExpandedId }: Props) {
  // PointerSensor with activation distance prevents misfiring drag when the user
  // means to click the expand chevron. TouchSensor with delay handles mobile.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  )

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = blocks.findIndex(b => b.id === active.id)
    const newIndex = blocks.findIndex(b => b.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const reordered = arrayMove(blocks, oldIndex, newIndex)
    onReorder(reordered.map(b => b.id))
  }

  if (blocks.length === 0) {
    return (
      <p className="text-sm text-stone-500 italic py-6 text-center">
        No blocks on this tab yet. Add one to get started.
      </p>
    )
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
        <ul className="space-y-2">
          {blocks.map(block => (
            <SortableRow
              key={block.id}
              block={block}
              initiallyExpanded={defaultExpandedId === block.id}
              onUpdate={contentJson => onUpdate(block.id, contentJson)}
              onDelete={() => onDelete(block.id)}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

function SortableRow({
  block,
  onUpdate,
  onDelete,
  initiallyExpanded = false,
}: {
  block: WeddingPageBlock
  onUpdate: (contentJson: string) => void
  onDelete: () => void
  initiallyExpanded?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  })
  const confirm = useConfirm()
  const [open, setOpen] = useState(initiallyExpanded)

  // If the parent later flags this row as initially-expanded (e.g. because the
  // couple just added a new block), open it. Only fires on transition false:to-true;
  // doesn't fight the user toggling it closed.
  useEffect(() => {
    if (initiallyExpanded) setOpen(true)
  }, [initiallyExpanded])

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <li ref={setNodeRef} style={style} className="bg-white border border-stone-200 rounded-lg">
      <div className="flex items-center gap-2 px-2 py-2">
        <button
          {...attributes}
          {...listeners}
          className="text-stone-400 hover:text-stone-700 cursor-grab active:cursor-grabbing p-1"
          aria-label="Drag to reorder"
        >
          <GripVertical size={16} />
        </button>
        <button
          onClick={() => setOpen(o => !o)}
          className="flex-1 flex items-center gap-2 text-left text-sm font-medium text-stone-700 hover:text-stone-900"
        >
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          {BLOCK_TYPE_LABELS[block.type]}
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
