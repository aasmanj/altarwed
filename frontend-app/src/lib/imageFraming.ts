import type { CSSProperties } from 'react'

// Shared rendering model for non-destructive crop/recenter (backend V70).
// The dashboard editor preview AND the public wedding site must apply this exact
// transform so what the couple positions is what guests see (WYSIWYG by construction).
// We keep the original uploaded file and only change how it is framed:
//   - object-position places the focal point of a cover-fit image (handles recenter).
//   - scale (origin = focal point) zooms in toward that same point (handles crop-tighter).
// All three values are nullable; null = centered, no zoom (the original, unframed).
export interface ImageFraming {
  focalX: number | null
  focalY: number | null
  zoom: number | null
}

export const CENTERED: ImageFraming = { focalX: 0.5, focalY: 0.5, zoom: 1 }

export function framingStyle(f: ImageFraming | null | undefined): CSSProperties {
  const fx = f?.focalX ?? 0.5
  const fy = f?.focalY ?? 0.5
  const zoom = f?.zoom ?? 1
  const pos = `${(fx * 100).toFixed(2)}% ${(fy * 100).toFixed(2)}%`
  return {
    objectFit: 'cover',
    objectPosition: pos,
    // Only emit a transform when zoomed so the un-zoomed common case stays cheap
    // and identical to a plain cover image.
    transform: zoom > 1 ? `scale(${zoom})` : undefined,
    transformOrigin: pos,
  }
}

export function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}

// Adapt the API/DTO shape (focalPointX/Y) to the UI framing shape (focalX/Y) so the
// mapping lives in one place instead of being inlined at every render site.
export function apiFraming(
  o: { focalPointX: number | null; focalPointY: number | null; zoom: number | null },
): ImageFraming {
  return { focalX: o.focalPointX, focalY: o.focalPointY, zoom: o.zoom }
}
