import { CeremonySection, CeremonySectionPayload } from './useCeremonySections'

export interface CeremonyReorderWrite {
  id: string
  payload: CeremonySectionPayload
}

// Stable display order: sort by sortOrder so the drag list and the printed program
// always agree, regardless of the order the API returns rows in.
export function orderedSections(sections: CeremonySection[]): CeremonySection[] {
  return [...sections].sort((a, b) => a.sortOrder - b.sortOrder)
}

// Optimistic cache shape after a drag: reassign sortOrder from the new array index so
// the list re-renders in the dragged order instantly (before the server confirms).
export function reorderSections(
  sections: CeremonySection[],
  orderedIds: string[],
): CeremonySection[] {
  const byId = new Map(sections.map(s => [s.id, s]))
  return orderedIds
    .map((id, index) => {
      const section = byId.get(id)
      return section ? { ...section, sortOrder: index } : undefined
    })
    .filter((s): s is CeremonySection => s !== undefined)
}

// Compute the minimal set of per-section updates to persist a new order. There is no
// bulk-reorder endpoint for ceremony sections, so we reuse the existing per-section
// PUT (useUpdateCeremonySection). sortOrder becomes the array index; a section is only
// written when its position actually moved, so nudging one item is not N writes.
export function computeCeremonyReorderWrites(
  sections: CeremonySection[],
  orderedIds: string[],
): CeremonyReorderWrite[] {
  const byId = new Map(sections.map(s => [s.id, s]))
  const writes: CeremonyReorderWrite[] = []
  orderedIds.forEach((id, index) => {
    const section = byId.get(id)
    if (!section || section.sortOrder === index) return
    writes.push({
      id,
      payload: {
        title: section.title,
        sectionType: section.sectionType,
        content: section.content ?? undefined,
        sortOrder: index,
      },
    })
  })
  return writes
}
