import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

// Source-level guards for issue #308 (checklist motion polish). vitest runs in
// a node environment here (no jsdom / testing-library), so we assert on the
// load-bearing JSX the same way a11yCluster.test.ts does. Every assertion fails
// on the pre-fix source and passes after:
//   1. Task rows regroup/remove through AnimatePresence + layout, keyed by task id
//   2. The detail panel expands/collapses with a height/opacity transition
//   3. The remove affordance is a 44px hit area with a per-task accessible name
//   4. The height tween (not covered by MotionConfig's transform/layout scope)
//      is explicitly gated on the user's reduced-motion preference
const src = readFileSync(
  path.join(process.cwd(), 'src', 'features/couple/checklist/ChecklistPage.tsx'),
  'utf8',
)

describe('checklist motion polish #308', () => {
  it('task rows animate regroup and removal via AnimatePresence popLayout with stable task-id keys', () => {
    // popLayout lifts exiting rows out of flow so sibling layout animations do
    // not fight the filter removal.
    expect(src).toContain('<AnimatePresence initial={false} mode="popLayout">')
    // Stable key: the task id, so AnimatePresence can track a row across the
    // grouped/filtered lists.
    expect(src).toContain('key={d.task.id}')
    // layout="position" slides rows to their new slot without the scale
    // distortion a full layout animation applies when row height changes.
    expect(src).toContain('layout="position"')
    // Both views share the animated list, so timeline and category behave the same.
    expect(src.match(/<AnimatedRowList items={items} {...handlers} \/>/g)?.length).toBe(2)
  })

  it('detail panel expand/collapse is a height/opacity transition, not a mount snap', () => {
    expect(src).toContain("animate={{ height: 'auto', opacity: 1 }}")
    expect(src).toContain('exit={{ height: 0, opacity: 0 }}')
    // Padding must sit on an inner element or content peeks out at height 0.
    expect(src).toContain('<div className="px-5 pb-4 pt-1 space-y-3">')
    // The old unanimated conditional mount is gone.
    expect(src).not.toContain('{expanded && (\n        <div className="px-5 pb-4 pt-1 space-y-3">')
  })

  it('remove affordance is a 44px hit area with a per-task accessible name', () => {
    expect(src).toContain('h-11 w-11')
    expect(src).toContain('aria-label={`Remove task: ${task.title}`}')
    // The bare text-xs "Remove" text button is gone.
    expect(src).not.toContain('className="shrink-0 text-xs text-red-300 hover:text-red-500 transition"')
  })

  it('height tween honors prefers-reduced-motion explicitly', () => {
    // MotionConfig reducedMotion="user" (App.tsx) covers transform and layout
    // animations; a raw height tween is a plain value animation, so the panel
    // must gate its own duration.
    expect(src).toContain('useReducedMotion')
    expect(src).toContain('reduceMotion ? 0 : 0.2')
    // No CSS transition may reimplement the motion outside framer's control:
    // Tailwind's `transition` (color/shadow on hover) is fine, but no
    // transition-[height]/transition-all sneaks into the checklist rows.
    expect(src).not.toContain('transition-[height]')
  })
})
