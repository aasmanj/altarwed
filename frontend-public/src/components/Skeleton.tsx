import type { ReactNode } from 'react'

// Shared skeleton primitives for the route-level loading.tsx files (issue #297).
// Server components on purpose: loading UI must ship zero client JS.
//
// Motion: `motion-safe:animate-pulse` shimmers only for users who allow motion;
// `motion-reduce:animate-none` pins the blocks static under
// prefers-reduced-motion, per WCAG 2.3.3 (animation from interactions).

interface SkeletonProps {
  className?: string
}

/**
 * One gray placeholder block. `aria-hidden` so screen readers never read
 * skeleton shapes as content; the announcement comes from SkeletonRegion.
 */
export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`rounded-lg bg-[#ece1cf] motion-safe:animate-pulse motion-reduce:animate-none ${className}`}
    />
  )
}

interface SkeletonRegionProps {
  /** Screen-reader-only loading announcement, e.g. "Loading vendors". */
  label: string
  className?: string
  children: ReactNode
}

/**
 * Container for a loading section: `aria-busy="true"` marks the region as
 * loading, and a visually hidden `role="status"` live region announces it
 * once, so assistive tech hears "Loading vendors" instead of silence or fake
 * data.
 */
export function SkeletonRegion({ label, className = '', children }: SkeletonRegionProps) {
  return (
    <div aria-busy="true" className={className}>
      <p role="status" className="sr-only">{label}</p>
      {children}
    </div>
  )
}
