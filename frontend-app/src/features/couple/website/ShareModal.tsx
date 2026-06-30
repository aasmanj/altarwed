import { useEffect, useRef, useState } from 'react'
import { X, Link2, MessageCircle, Send, Share2 } from 'lucide-react'

interface Props {
  isOpen: boolean
  onClose: () => void
  slug: string
  coupleNames: string
}

export default function ShareModal({ isOpen, onClose, slug, coupleNames }: Props) {
  const publicUrl = `https://www.altarwed.com/wedding/${slug}`
  const [copied, setCopied] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (isOpen) closeRef.current?.focus()
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const copyLink = async () => {
    await navigator.clipboard.writeText(publicUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const nativeShare = async () => {
    if (!navigator.share) return
    await navigator.share({ title: `${coupleNames}'s Wedding`, url: publicUrl }).catch(() => {})
  }

  const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(publicUrl)}`
  const smsBody = encodeURIComponent(`We just launched our wedding website! Check it out: ${publicUrl}`)
  const smsUrl = `sms:?body=${smsBody}`

  const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-xl p-6">
        <button
          ref={closeRef}
          onClick={onClose}
          aria-label="Close share modal"
          className="absolute top-4 right-4 rounded-full p-1.5 text-[#8a6a4a] hover:bg-[#fdfaf6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af6a] transition"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center mb-6">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#fdf6ea]">
            <Share2 className="h-6 w-6 text-[#d4af6a]" aria-hidden="true" />
          </div>
          <h2 id="share-modal-title" className="font-serif text-2xl font-bold text-[#3b2f2f]">
            Your site is live!
          </h2>
          <p className="text-sm text-[#6b5344] mt-1">
            Share it with your family and guests
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-[#e8dcc8] bg-[#fdfaf6] px-3 py-2.5 mb-5">
          <span className="flex-1 text-sm text-[#3b2f2f] truncate font-mono">{publicUrl}</span>
          <button
            onClick={copyLink}
            className="shrink-0 rounded-md bg-[#d4af6a] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#c49d55] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af6a]"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          {canNativeShare && (
            <ShareButton icon={<Send className="w-4 h-4" />} label="Share" onClick={nativeShare} />
          )}
          <a
            href={fbUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl border border-[#e8dcc8] bg-white px-4 py-3 text-sm font-medium text-[#3b2f2f] hover:border-[#d4af6a] hover:bg-[#fdfaf6] transition"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#1877f2" aria-hidden="true"><path d="M24 12.073C24 5.404 18.627 0 12 0S0 5.404 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.883v2.261h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/></svg>
            Facebook
          </a>
          <a
            href={smsUrl}
            className="flex items-center justify-center gap-2 rounded-xl border border-[#e8dcc8] bg-white px-4 py-3 text-sm font-medium text-[#3b2f2f] hover:border-[#d4af6a] hover:bg-[#fdfaf6] transition"
          >
            <MessageCircle className="w-4 h-4 text-[#22c55e]" />
            Text
          </a>
          <button
            onClick={copyLink}
            className="flex items-center justify-center gap-2 rounded-xl border border-[#e8dcc8] bg-white px-4 py-3 text-sm font-medium text-[#3b2f2f] hover:border-[#d4af6a] hover:bg-[#fdfaf6] transition"
          >
            <Link2 className="w-4 h-4 text-[#d4af6a]" />
            {copied ? 'Copied!' : 'Copy link'}
          </button>
        </div>

        <a
          href="/dashboard/communications"
          onClick={onClose}
          className="block w-full rounded-xl bg-[#3b2f2f] py-3 text-center text-sm font-semibold text-[#d4af6a] hover:bg-[#4a3c3c] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af6a]"
        >
          Now send save-the-dates to your guests →
        </a>
      </div>
    </div>
  )
}

function ShareButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center gap-2 rounded-xl border border-[#e8dcc8] bg-white px-4 py-3 text-sm font-medium text-[#3b2f2f] hover:border-[#d4af6a] hover:bg-[#fdfaf6] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af6a]"
    >
      {icon}
      {label}
    </button>
  )
}
