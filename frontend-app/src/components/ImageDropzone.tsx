import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { normalizeImageFile } from '@/lib/normalizeImageFile'

// Click-or-drag image picker. Wraps any visual target; on click or drop it opens
// the file dialog / reads the dropped file, runs it through normalizeImageFile
// (so HEIC is converted), and hands a ready-to-upload File to onPick. Keyboard
// operable (Enter/Space) and focusable, per the project Accessibility Rules.
export default function ImageDropzone({
  onPick,
  disabled = false,
  children,
  className = '',
  ariaLabel = 'Upload an image',
}: {
  onPick: (file: File) => void
  disabled?: boolean
  children: ReactNode
  className?: string
  ariaLabel?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const deliver = async (file: File | undefined) => {
    if (!file) return
    onPick(await normalizeImageFile(file))
  }

  const open = () => { if (!disabled) inputRef.current?.click() }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={ariaLabel}
      aria-disabled={disabled}
      onClick={open}
      onKeyDown={e => {
        if (disabled) return
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() }
      }}
      onDragOver={e => { e.preventDefault(); if (!disabled) setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => {
        e.preventDefault()
        setDragOver(false)
        if (!disabled) deliver(e.dataTransfer.files?.[0])
      }}
      className={`${className} ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'} ${
        dragOver ? 'ring-2 ring-[#d4af6a] border-[#d4af6a]' : ''
      }`}
    >
      {children}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,.heic,.heif"
        className="hidden"
        disabled={disabled}
        onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; deliver(f) }}
      />
    </div>
  )
}
