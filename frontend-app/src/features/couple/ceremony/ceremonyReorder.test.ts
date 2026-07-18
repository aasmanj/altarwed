import { describe, it, expect } from 'vitest'
import { arrayMove } from '@dnd-kit/sortable'
import {
  orderedSections,
  reorderSections,
  computeCeremonyReorderWrites,
  CeremonyReorderWrite,
} from './ceremonyReorder'
import { CeremonySection } from './useCeremonySections'

// Minimal section factory. Only the fields the reorder logic reads matter.
function section(id: string, sortOrder: number, over: Partial<CeremonySection> = {}): CeremonySection {
  return {
    id,
    coupleId: 'couple-1',
    title: `Section ${id}`,
    sectionType: 'CUSTOM',
    content: null,
    sortOrder,
    createdAt: '2026-07-12T00:00:00Z',
    updatedAt: '2026-07-12T00:00:00Z',
    ...over,
  }
}

// A drag moves an item from index `from` to index `to`, exactly like handleDragEnd.
function idsAfterDrag(sections: CeremonySection[], from: number, to: number): string[] {
  const ids = sections.map(s => s.id)
  return arrayMove(ids, from, to)
}

describe('orderedSections', () => {
  it('sorts by sortOrder regardless of input order', () => {
    const input = [section('b', 2), section('a', 0), section('c', 1)]
    expect(orderedSections(input).map(s => s.id)).toEqual(['a', 'c', 'b'])
  })

  it('does not mutate the input array', () => {
    const input = [section('b', 2), section('a', 0)]
    orderedSections(input)
    expect(input.map(s => s.id)).toEqual(['b', 'a'])
  })
})

describe('reorderSections (optimistic cache shape)', () => {
  it('reassigns sortOrder to the new array index', () => {
    const sections = [section('a', 0), section('b', 1), section('c', 2)]
    const orderedIds = idsAfterDrag(sections, 2, 0) // move c to the front
    const result = reorderSections(sections, orderedIds)
    expect(result.map(s => [s.id, s.sortOrder])).toEqual([
      ['c', 0],
      ['a', 1],
      ['b', 2],
    ])
  })
})

describe('computeCeremonyReorderWrites (persistence)', () => {
  it('persists the new position for every section that moved', () => {
    const sections = [section('a', 0), section('b', 1), section('c', 2)]
    // Drag the last section to the top: c,a,b.
    const orderedIds = idsAfterDrag(sections, 2, 0)

    const writes = computeCeremonyReorderWrites(sections, orderedIds)

    // Applying the writes on top of the original sortOrders must yield 0,1,2 in the
    // dragged order, with no duplicate positions and no gaps.
    const persisted = applyWrites(sections, writes)
    expect(persisted).toEqual([
      { id: 'c', sortOrder: 0 },
      { id: 'a', sortOrder: 1 },
      { id: 'b', sortOrder: 2 },
    ])
    expect(new Set(persisted.map(p => p.sortOrder)).size).toBe(persisted.length)
  })

  it('only writes the sections whose position actually changed', () => {
    const sections = [section('a', 0), section('b', 1), section('c', 2), section('d', 3)]
    // Swap the middle two: a,c,b,d. Only b and c moved.
    const orderedIds = idsAfterDrag(sections, 1, 2)

    const writes = computeCeremonyReorderWrites(sections, orderedIds)

    expect(writes.map(w => w.id).sort()).toEqual(['b', 'c'])
    expect(writes.find(w => w.id === 'c')?.payload.sortOrder).toBe(1)
    expect(writes.find(w => w.id === 'b')?.payload.sortOrder).toBe(2)
  })

  it('emits no writes when order is unchanged', () => {
    const sections = [section('a', 0), section('b', 1)]
    expect(computeCeremonyReorderWrites(sections, ['a', 'b'])).toEqual([])
  })

  it('carries the section content through so the PUT does not blank it', () => {
    const sections = [
      section('a', 0, { content: 'Genesis 2:24' }),
      section('b', 1, { content: 'Opening prayer' }),
    ]
    const writes = computeCeremonyReorderWrites(sections, ['b', 'a'])
    const bWrite = writes.find(w => w.id === 'b')
    expect(bWrite?.payload.content).toBe('Opening prayer')
    expect(bWrite?.payload.title).toBe('Section b')
    expect(bWrite?.payload.sectionType).toBe('CUSTOM')
  })
})

// Simulate the server applying the per-section PUTs, then read back the final order.
function applyWrites(
  sections: CeremonySection[],
  writes: CeremonyReorderWrite[],
): { id: string; sortOrder: number }[] {
  const byId = new Map(sections.map(s => [s.id, s.sortOrder]))
  for (const w of writes) byId.set(w.id, w.payload.sortOrder)
  return [...byId.entries()]
    .map(([id, sortOrder]) => ({ id, sortOrder }))
    .sort((a, b) => a.sortOrder - b.sortOrder)
}
