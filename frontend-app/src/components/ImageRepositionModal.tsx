import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useModalA11y } from '@/lib/useModalA11y'
import { framingStyle, clamp01, type ImageFraming } from '@/lib/imageFraming'

interface Props {
  src: string
  // Frame aspect ratio (width / height). 1 = square (avatars, album thumbnails).
  aspect?: number
  // Round mask for wedding-party avatars; rectangular for album photos.
  shape?: 'circle' | 'rect'
  initial: ImageFraming
  title?: string
  saving?: boolean
  onCancel: () => void
  onSave: (framing: { focalX: number; focalY: number; zoom: number }) => void
}

const ZOOM_MIN = 1
const ZOOM_MAX = 3

// Reposition (non-destructive crop) UI. Drag the image to recenter, slide to zoom.
// The preview uses the same framingStyle the public site renders with, so the couple
// sees exactly what guests will see. We never modify the file: we emit focalX/focalY
// (0-1) and zoom and let CSS object-position + scale do the framing on render.
export default function ImageRepositionModal({
  src, aspect = 1, shape = 'rect', initial, title = 'Reposition photo', saving, onCancel, onSave,
}: Props) {
  const [fx, setFx] = useState(initial.focalX ?? 0.5)
  const [fy, setFy] = useState(initial.focalY ?? 0.5)
  const [zoom, setZoom] = useState(initial.zoom ?? 1)

  const frameRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const last = useRef({ x: 0, y: 0 })
  const dialogRef = useModalA11y(true, onCancel)

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragging.current = true
    last.current = { x: e.clientX, y: e.clientY }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return
    const rect = frameRef.current?.getBoundingClientRect()
    if (!rect) return
    const dx = e.clientX - last.current.x
    const dy = e.clientY - last.current.y
    last.current = { x: e.clientX, y: e.clientY }
    // Dragging right reveals the LEFT of the image (object-position moves toward 0).
    // Divide by zoom so panning slows down as you zoom in, which feels natural.
    setFx(prev => clamp01(prev - dx / rect.width / zoom))
    setFy(prev => clamp01(prev - dy / rect.height / zoom))
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragging.current = false
    e.currentTarget.releasePointerCapture(e.pointerId)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md p-6 max-h-[92vh] overflow-y-auto"
      >
        <h2 className="text-lg font-semibold text-stone-900 mb-1">{title}</h2>
        <p className="text-xs text-stone-500 mb-4">Drag to reposition, slide to zoom. Your original photo is never changed.</p>

        <div
          ref={frameRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{ aspectRatio: String(aspect), touchAction: 'none' }}
          className={`relative w-full overflow-hidden bg-stone-100 cursor-grab active:cursor-grabbing select-none mx-auto ${
            shape === 'circle' ? 'rounded-full max-w-[260px]' : 'rounded-lg'
          }`}
        >
          <img
            src={src}
            alt="Reposition preview"
            draggable={false}
            className="w-full h-full pointer-events-none"
            style={framingStyle({ focalX: fx, focalY: fy, zoom })}
          />
        </div>

        <label htmlFor="reposition-zoom" className="block mt-5 mb-1 text-sm text-stone-600">Zoom</label>
        <input
          id="reposition-zoom"
          type="range"
          min={ZOOM_MIN}
          max={ZOOM_MAX}
          step={0.02}
          value={zoom}
          onChange={e => setZoom(Number(e.target.value))}
          className="w-full accent-amber-600"
        />

        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="flex-1 py-2.5 border border-stone-300 rounded-lg text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave({ focalX: fx, focalY: fy, zoom })}
            disabled={saving}
            className="flex-1 py-2.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save position'}
          </button>
        </div>
      </div>
    </div>
  )
}
