import { useEffect, useRef, useState } from 'react'
import ImageDropzone from '@/components/ImageDropzone'
import { Link } from 'react-router-dom'
import confetti from 'canvas-confetti'
import { useAuth } from '@/core/auth/AuthContext'
import PageHeader from '@/components/PageHeader'
import { useConfirm } from '@/components/ConfirmDialog'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/core/api/client'
import { useWeddingWebsite } from '@/features/couple/website/useWeddingWebsite'
import { useGuests } from '@/features/couple/guests/useGuests'
import { QRCodeCanvas } from 'qrcode.react'

export default function SaveTheDatePage() {
  const { user } = useAuth()
  const coupleId = user?.id ?? ''
  const qc = useQueryClient()
  const { data: website } = useWeddingWebsite(coupleId)
  const { data: guests = [] } = useGuests(coupleId)
  const [sent, setSent] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[] | null>(null)

  useEffect(() => {
    if (!sent) return
    const timer = setTimeout(() => setSent(false), 5000)
    return () => clearTimeout(timer)
  }, [sent])
  const qrRef = useRef<HTMLCanvasElement>(null)
  const confirm = useConfirm()

  const uploadStdImage = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      return apiClient.post(`/api/v1/uploads/wedding-websites/${website?.id}/std-image`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then(r => r.data as { imageUrl: string })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wedding-website', coupleId] }),
  })

  const removeStdImage = useMutation({
    mutationFn: () =>
      apiClient.delete(`/api/v1/uploads/wedding-websites/${website?.id}/std-image`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wedding-website', coupleId] }),
  })

  const emailGuests = guests.filter(g => g.email)
  const eligibleCount = emailGuests.length

  const activeIds = selectedIds ?? emailGuests.map(g => g.id)
  const sendCount = activeIds.length

  function toggleGuest(id: string) {
    const current = selectedIds ?? emailGuests.map(g => g.id)
    setSelectedIds(current.includes(id) ? current.filter(x => x !== id) : [...current, id])
  }

  async function handleSend() {
    if (sendMutation.isPending || sent || sendCount === 0) return
    if (!await confirm({
      title: `Send save-the-dates to ${sendCount} guest${sendCount !== 1 ? 's' : ''}?`,
      message: 'Each selected guest will receive your faith-themed announcement. Make sure your wedding website is published first.',
      confirmLabel: 'Send now',
    })) return
    sendMutation.mutate()
  }

  const sendMutation = useMutation({
    mutationFn: () =>
      apiClient.post(`/api/v1/save-the-dates/couple/${coupleId}/send`,
        selectedIds !== null ? { guestIds: selectedIds } : {}
      ).then(r => r.data),
    onSuccess: () => {
      setSent(true)
      confetti({
        particleCount: 180,
        spread: 90,
        origin: { y: 0.5 },
        colors: ['#d4af6a', '#3b2f2f', '#f5ede0', '#fbbf24', '#fde68a'],
      })
    },
  })

  const coupleNames = user?.partnerOneName && user?.partnerTwoName
    ? `${user.partnerTwoName} & ${user.partnerOneName}`
    : 'The Couple'
  const weddingDate = website?.weddingDate
    ? new Date(website.weddingDate + 'T12:00:00').toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      })
    : 'Date TBD'
  const weddingUrl = website
    ? `https://www.altarwed.com/wedding/${website.slug}`
    : 'https://www.altarwed.com'

  return (
    <div className="min-h-screen bg-ivory">
      <PageHeader title="Save the Dates" subtitle="Send a faith-themed email to all your guests" maxWidth="max-w-3xl" />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8">

        {/* Custom STD image upload */}
        <div className="bg-white rounded-xl border border-stone-200 p-6">
          <h2 className="font-semibold text-stone-900 mb-1">Custom design image</h2>
          <p className="text-sm text-stone-500 mb-4">
            Upload an image from Canva or any design tool (JPEG, PNG, or WebP, max 15 MB). It will appear at the top of every save-the-date email you send.
          </p>
          {website?.stdImageUrl ? (
            <div className="space-y-3">
              <img
                src={website.stdImageUrl}
                alt="Save-the-date design"
                className="w-full rounded-lg border border-stone-200 object-cover max-h-64"
              />
              <div className="flex gap-2">
                <label className={`cursor-pointer rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 transition ${uploadStdImage.isPending ? 'opacity-50 pointer-events-none' : ''}`}>
                  {uploadStdImage.isPending ? 'Uploading…' : 'Replace'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    disabled={uploadStdImage.isPending}
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadStdImage.mutate(f) }}
                  />
                </label>
                <button
                  onClick={() => removeStdImage.mutate()}
                  disabled={removeStdImage.isPending}
                  className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-50 transition disabled:opacity-50"
                >
                  {removeStdImage.isPending ? 'Removing…' : 'Remove'}
                </button>
              </div>
            </div>
          ) : (
            <ImageDropzone
              onPick={file => uploadStdImage.mutate(file)}
              disabled={uploadStdImage.isPending || !website}
              ariaLabel="Upload save-the-date design image"
              className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-stone-300 px-6 py-8 hover:border-amber-400 hover:bg-amber-50 transition ${(uploadStdImage.isPending || !website) ? 'opacity-50' : ''}`}
            >
              {uploadStdImage.isPending ? (
                <p className="text-sm text-stone-500">Uploading…</p>
              ) : (
                <>
                  <svg className="w-8 h-8 text-stone-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  <p className="text-sm font-medium text-stone-700">Drag and drop or click to upload</p>
                  <p className="text-xs text-stone-400 mt-1">JPEG, PNG, or WebP up to 15 MB</p>
                </>
              )}
            </ImageDropzone>
          )}
          {uploadStdImage.isError && (
            <p className="mt-2 text-xs text-red-600">Upload failed. Check the file type and size and try again.</p>
          )}
        </div>

        {/* Email preview */}
        <div>
          <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-4">Email Preview</h2>
          <div className="bg-[#fdfaf6] rounded-2xl border border-[#e8dcc8] p-6 sm:p-10 text-center shadow-sm overflow-hidden">
            {website?.stdImageUrl && (
              <img
                src={website.stdImageUrl}
                alt="Save-the-date design"
                className="w-full rounded-lg mb-6 object-cover"
              />
            )}
            <p className="text-xs uppercase tracking-[0.2em] text-[#8a6a4a] mb-2">Save the Date</p>
            <p className="font-serif text-3xl font-bold text-[#3b2f2f] mb-1">{coupleNames.split(' & ')[0]}</p>
            <p className="font-serif text-xl text-[#d4af6a] mb-1">&amp;</p>
            <p className="font-serif text-3xl font-bold text-[#3b2f2f] mb-6">{coupleNames.split(' & ')[1] ?? ''}</p>
            <div className="border-t border-b border-[#e8dcc8] py-5 mb-6">
              <p className="text-[#8a6a4a] text-sm mb-1">are getting married on</p>
              <p className="font-semibold text-[#3b2f2f]">{weddingDate}</p>
            </div>
            <p className="text-[#8a6a4a] text-xs mb-4">Formal invitation to follow · Visit their wedding website ↓</p>
            <div className="inline-block px-8 py-3 bg-[#3b2f2f] text-[#d4af6a] rounded text-sm font-medium tracking-wide">
              Visit Our Wedding Website
            </div>
            <p className="mt-6 text-[#8a6a4a] text-xs italic">
              "And over all these virtues put on love, which binds them all together in perfect unity." (Colossians 3:14)
            </p>
          </div>
        </div>

        {/* Send panel */}
        <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-4">
          <h2 className="font-semibold text-stone-900">Send to your guests</h2>

          {eligibleCount === 0 ? (
            <p className="text-sm text-stone-500">
              No guests with email addresses yet.{' '}
              <Link to="/dashboard/guests" className="text-amber-600 font-medium underline hover:text-amber-700">
                Add guests first
              </Link>.
            </p>
          ) : (
            <>
              {/* Guest selector */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                    Select recipients ({sendCount} of {eligibleCount} selected)
                  </p>
                  <div className="flex gap-2 text-xs">
                    <button
                      onClick={() => setSelectedIds(null)}
                      className="text-amber-700 hover:underline"
                    >
                      All
                    </button>
                    <button
                      onClick={() => setSelectedIds([])}
                      className="text-stone-500 hover:underline"
                    >
                      None
                    </button>
                  </div>
                </div>
                <div className="max-h-52 overflow-y-auto rounded-lg border border-stone-200 divide-y divide-stone-100">
                  {emailGuests.map(g => (
                    <label key={g.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-stone-50">
                      <input
                        type="checkbox"
                        checked={activeIds.includes(g.id)}
                        onChange={() => toggleGuest(g.id)}
                        className="h-4 w-4 rounded border-stone-300 accent-amber-600"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-stone-800">{g.name}</p>
                        <p className="text-xs text-stone-400 truncate">{g.email}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t border-stone-100">
                <div>
                  {website && (
                    <p className="text-xs text-stone-400">
                      Includes link to: <span className="text-amber-600">{weddingUrl}</span>
                    </p>
                  )}
                </div>
                {sent ? (
                  <div className="flex items-center gap-2 text-green-600 font-medium whitespace-nowrap">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Sent!
                  </div>
                ) : (
                  <button
                    onClick={handleSend}
                    disabled={sendMutation.isPending || sendCount === 0}
                    className="whitespace-nowrap px-5 py-2.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors"
                  >
                    {sendMutation.isPending ? 'Sending…' : `Send to ${sendCount} guest${sendCount !== 1 ? 's' : ''}`}
                  </button>
                )}
              </div>
            </>
          )}

          {sent && (
            <div className="p-3 bg-green-50 rounded-lg text-sm text-green-700">
              Save-the-dates sent to {sendMutation.data?.sent ?? sendCount} guests.{' '}
              <Link to="/dashboard/guests" className="underline">View guest list</Link>
            </div>
          )}
        </div>

        {/* QR Code */}
        {website && (
          <div className="bg-white rounded-xl border border-stone-200 p-6">
            <h2 className="font-semibold text-stone-900 mb-1">QR Code for physical invitations</h2>
            <p className="text-sm text-stone-500 mb-5">
              Print this QR code on your physical save-the-dates or invitations so guests can scan to visit your wedding website.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-8">
              <div className="flex-shrink-0 p-4 bg-white border border-stone-200 rounded-xl shadow-sm">
                <QRCodeCanvas
                  ref={qrRef}
                  value={weddingUrl}
                  size={160}
                  fgColor="#3b2f2f"
                  bgColor="#ffffff"
                  level="M"
                />
              </div>
              <div className="space-y-3 text-center sm:text-left">
                <p className="text-xs text-stone-400 font-mono break-all">{weddingUrl}</p>
                <button
                  onClick={() => {
                    const canvas = qrRef.current
                    if (!canvas) return
                    const link = document.createElement('a')
                    link.download = `${website.slug}-qr-code.png`
                    link.href = canvas.toDataURL('image/png')
                    link.click()
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#3b2f2f] text-white rounded-lg text-sm font-medium hover:bg-[#5c4033] transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download PNG
                </button>
                <p className="text-xs text-stone-400">Downloads as a high-resolution PNG ready for print.</p>
              </div>
            </div>
          </div>
        )}

        {/* Tips */}
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-5 text-sm text-amber-800 space-y-1">
          <p className="font-semibold mb-2">Tips</p>
          <p>· Send save-the-dates 6–12 months before the wedding for destination weddings, 4–6 months for local.</p>
          <p>· Make sure your wedding website is published before sending so guests can visit it.</p>
          <p>· Formal invitations with RSVP links can be sent separately from the Guest List page.</p>
        </div>
      </div>
    </div>
  )
}
