// Table shape + capacity-preset vocabulary for the seating editor (issue #356).
//
// Kept as a dependency-free module so the choices are unit-testable without a DOM and so the
// editor, the modal, and the printed board all render from a single source of truth. The string
// values match the backend contract exactly (SeatingTable.SHAPE_* in the domain model): ROUND,
// RECTANGLE, HEAD.

export type TableShape = 'ROUND' | 'RECTANGLE' | 'HEAD'

export const TABLE_SHAPES: readonly TableShape[] = ['ROUND', 'RECTANGLE', 'HEAD'] as const

// Round is the classic banquet table and the backend default, so it is what an existing table
// with no stored shape renders as.
export const DEFAULT_TABLE_SHAPE: TableShape = 'ROUND'

// Quick-pick seat counts offered in the modal. 2 is a sweetheart table, 6/8/10/12 are the common
// banquet sizes couples actually rent. The number input still allows any 1..100 value.
export const CAPACITY_PRESETS: readonly number[] = [2, 6, 8, 10, 12] as const

interface TableShapeMeta {
  value: TableShape
  label: string
  // A one-word hint of the motif so the selector reads clearly for screen readers.
  description: string
}

const SHAPE_META: Record<TableShape, TableShapeMeta> = {
  ROUND: { value: 'ROUND', label: 'Round', description: 'Round banquet table' },
  RECTANGLE: { value: 'RECTANGLE', label: 'Rectangle', description: 'Long rectangular table' },
  HEAD: { value: 'HEAD', label: 'Head', description: 'Head table for the wedding party' },
}

// Coerce any incoming value (including the null the API returns until the shape column ships, or a
// value from an older client) to a known shape so rendering never breaks.
export function normalizeShape(value: string | null | undefined): TableShape {
  return value === 'RECTANGLE' || value === 'HEAD' ? value : DEFAULT_TABLE_SHAPE
}

export function shapeLabel(value: string | null | undefined): string {
  return SHAPE_META[normalizeShape(value)].label
}

export function shapeDescription(value: string | null | undefined): string {
  return SHAPE_META[normalizeShape(value)].description
}
