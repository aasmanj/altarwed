import type { CSSProperties } from 'react'

// Public-site copy of the dashboard's framing model (frontend-app/src/lib/imageFraming.ts).
// The two apps cannot share code, so this MUST stay in sync: the couple positions a photo
// in the dashboard and these exact CSS rules reproduce that framing for guests. We keep the
// original file and only change how it is displayed (object-position for recenter, scale
// from the focal point for zoom). All values nullable; null = centered, no zoom.
export function framingStyle(
  f: { focalPointX: number | null; focalPointY: number | null; zoom: number | null } | null | undefined,
): CSSProperties {
  const fx = f?.focalPointX ?? 0.5
  const fy = f?.focalPointY ?? 0.5
  const zoom = f?.zoom ?? 1
  const pos = `${(fx * 100).toFixed(2)}% ${(fy * 100).toFixed(2)}%`
  return {
    objectFit: 'cover',
    objectPosition: pos,
    transform: zoom > 1 ? `scale(${zoom})` : undefined,
    transformOrigin: pos,
  }
}
