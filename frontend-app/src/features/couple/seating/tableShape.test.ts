import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import {
  CAPACITY_PRESETS,
  DEFAULT_TABLE_SHAPE,
  TABLE_SHAPES,
  normalizeShape,
  shapeDescription,
  shapeLabel,
} from './tableShape'

// Issue #356: seating tables gain a shape (round / rectangle / head) and the modal offers
// capacity presets. vitest runs in a node environment here (no jsdom / testing-library), so the
// behavior is verified two ways: the pure shape/preset vocabulary below, plus source-level
// assertions that the editor, modal, board, and API hook are actually wired to it. Each case
// fails on the pre-change code (no shape module, no presets, no shape in the payload).

function read(rel: string): string {
  return readFileSync(path.join(__dirname, rel), 'utf8')
}

describe('table shape vocabulary', () => {
  it('offers exactly the three shapes in the acceptance criteria', () => {
    expect([...TABLE_SHAPES]).toEqual(['ROUND', 'RECTANGLE', 'HEAD'])
  })

  it('defaults to ROUND, the classic banquet table and backend default', () => {
    expect(DEFAULT_TABLE_SHAPE).toBe('ROUND')
  })

  it('normalizes unknown / null / legacy values to the default so rendering never breaks', () => {
    expect(normalizeShape(null)).toBe('ROUND')
    expect(normalizeShape(undefined)).toBe('ROUND')
    expect(normalizeShape('')).toBe('ROUND')
    expect(normalizeShape('OVAL')).toBe('ROUND')
    expect(normalizeShape('RECTANGLE')).toBe('RECTANGLE')
    expect(normalizeShape('HEAD')).toBe('HEAD')
  })

  it('gives each shape a human label and an accessible description', () => {
    expect(shapeLabel('ROUND')).toBe('Round')
    expect(shapeLabel('RECTANGLE')).toBe('Rectangle')
    expect(shapeLabel('HEAD')).toBe('Head')
    expect(shapeDescription('HEAD')).toMatch(/head table/i)
  })
})

describe('capacity presets', () => {
  it('offers the 2 / 6 / 8 / 10 / 12 quick picks from the acceptance criteria', () => {
    expect([...CAPACITY_PRESETS]).toEqual([2, 6, 8, 10, 12])
  })
})

describe('seating editor wiring', () => {
  const page = read('SeatingPage.tsx')

  it('renders the shape motif on the table cards', () => {
    expect(page).toContain('TableShapeIcon')
  })

  it('drives the modal shape selector from the shared shape list', () => {
    expect(page).toContain('TABLE_SHAPES.map')
    expect(page).toContain('setShape(s)')
  })

  it('offers the capacity presets in the modal', () => {
    expect(page).toContain('CAPACITY_PRESETS.map')
    expect(page).toContain('setCapacity(String(preset))')
  })

  it('persists both shape and capacity through the create and update paths', () => {
    // create.mutateAsync and update.mutateAsync must both carry shape (capacity was already sent).
    expect(page).toMatch(/create\.mutateAsync\(\{[^}]*capacity: cap[^}]*shape[^}]*\}\)/s)
    expect(page).toMatch(/update\.mutateAsync\(\{[^}]*capacity: cap[^}]*shape[^}]*\}\)/s)
  })
})

describe('printed board wiring', () => {
  it('renders the chosen shape on the printed find-your-seat board', () => {
    expect(read('SeatingBoardPage.tsx')).toContain('TableShapeIcon')
  })
})

describe('api hook', () => {
  const hook = read('useSeatingTables.ts')

  it('carries shape on the SeatingTable model', () => {
    expect(hook).toMatch(/shape\?:\s*TableShape/)
  })

  it('accepts shape in the create and update payloads', () => {
    expect(hook).toMatch(/name: string; capacity: number; shape\?: TableShape/)
    expect(hook).toMatch(/capacity\?: number; shape\?: TableShape/)
  })
})
