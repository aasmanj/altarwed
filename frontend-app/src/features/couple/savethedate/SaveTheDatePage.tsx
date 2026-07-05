import { useEffect, useRef, useState } from 'react'
import ImageDropzone from '@/components/ImageDropzone'
import { normalizeImageFile, IMAGE_ACCEPT } from '@/lib/normalizeImageFile'
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL, uploadErrorMessage } from '@/lib/upload'
import { Link } from 'react-router-dom'
import confetti from 'canvas-confetti'
import { useAuth } from '@/core/auth/AuthContext'
import PageHeader from '@/components/PageHeader'
import { useConfirm } from '@/components/ConfirmDialog'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiClient } from '@/core/api/client'
import { errorDetail } from '@/lib/apiError'
import { useWeddingWebsite, usePublishWeddingWebsite } from '@/features/couple/website/useWeddingWebsite'
import { useGuests, type SaveTheDateSendResult } from '@/features/couple/guests/useGuests'
import { formatWeddingDate } from '@/lib/date'
import InvalidEmailsModal from './InvalidEmailsModal'
import { QRCodeCanvas } from 'qrcode.react'

// Maps the latest delivery status (from the Resend webhook) to a recipient badge.
// Falls back to the optimistic "Sent" stamp until a delivery/bounce event arrives.
function stdBadge(status: string | null, sentAt: string | null): { label: string; cls: string } | null {
  switch (status) {
    case 'DELIVERED': return { label: 'Delivered', cls: 'text-green-600' }
    case 'BOUNCED': return { label: 'Bounced', cls: 'text-rose-600' }
    case 'COMPLAINED': return { label: 'Marked spam', cls: 'text-rose-600' }
    case 'DELAYED': return { label: 'Delivery delayed', cls: 'text-amber-600' }
    default:
      return sentAt ? { label: `Sent ${new Date(sentAt).toLocaleDateString()}`, cls: 'text-stone-500' } : null
  }
}

export default function SaveTheDatePage() {
  const { user } = useAuth()
  const coupleId = user?.id ?? ''
  const qc = useQueryClient()
  const { data: website } = useWeddingWebsite(coupleId)
  const publishSite = usePublishWeddingWebsite(coupleId)
  const { data: guests = [] } = useGuests(coupleId)
  const [sent, setSent] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[] | null>(null)
  // Post-send breakdown (queued vs skipped) and the malformed addresses to surface.
  const [result, setResult] = useState<SaveTheDateSendResult | null>(null)
  const [showInvalidModal, setShowInvalidModal] = useState(false)
  // Client-side rejection (over the shared size cap) shown before any request
  // fires; kept separate from the mutation's own server error state.
  const [stdImageError, setStdImageError] = useState<string | null>(null)
  // Per-attempt dedup token (issue #232), mirroring the print-order flow. A retry of the
  // SAME attempt (e.g. after a lost response) keeps the key and is deduped server-side, so
  // the batch is never re-emailed. A new selection (below) or a completed send rotates it.
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => crypto.randomUUID())

  useEffect(() => {
    if (!sent) return
    const timer = setTimeout(() => setSent(false), 5000)
    return () => clearTimeout(timer)
  }, [sent])

  // Rotate the dedup key whenever the recipient selection changes, so each distinct batch is a
  // fresh attempt server-side. Retries of the SAME selection keep the key (deduped). onSuccess
  // also rotates it explicitly, since resetting to the default (null) selection after a send
  // may not change this dependency.
  useEffect(() => {
    setIdempotencyKey(crypto.randomUUID())
  }, [selectedIds])
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

  // Single gate both the dropzone and the "Replace" picker go through: reject
  // anything over the shared cap client-side (saves a wasted upload), otherwise
  // fire the mutation. The file is already HEIC-normalized by the time it lands
  // here (ImageDropzone and the picker both normalize first).
  const handleStdImagePick = (file: File) => {
    if (file.size > MAX_UPLOAD_BYTES) {
      setStdImageError(`That image is over ${MAX_UPLOAD_LABEL}. Please choose a smaller file.`)
      return
    }
    setStdImageError(null)
    uploadStdImage.mutate(file)
  }

  const removeStdImage = useMutation({
    mutationFn: () =>
      apiClient.delete(`/api/v1/uploads/wedding-websites/${website?.id}/std-image`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wedding-website', coupleId] }),
  })

  const emailGuests = guests.filter(g => g.email)
  const eligibleCount = emailGuests.length
  const alreadySentCount = emailGuests.filter(g => g.saveTheDateSentAt).length

  // Default selection is everyone who has NOT been sent a save-the-date yet, so a
  // couple who adds guests after a first send does not accidentally re-email the
  // whole list. The All / Unsent / None buttons still let them override.
  const unsentIds = emailGuests.filter(g => !g.saveTheDateSentAt).map(g => g.id)
  const activeIds = selectedIds ?? unsentIds
  const sendCount = activeIds.length

  function toggleGuest(id: string) {
    const current = selectedIds ?? unsentIds
    setSelectedIds(current.includes(id) ? current.filter(x => x !== id) : [...current, id])
  }

  async function handleSend() {
    if (sendMutation.isPending || sent || sendCount === 0) return
    // Word the confirm copy from the live published state so the couple knows
    // exactly where the "Visit Our Wedding Website" link will land before they
    // commit to emailing the whole list.
    const published = website?.isPublished ?? false
    if (!await confirm({
      title: `Send save-the-dates to ${sendCount} guest${sendCount !== 1 ? 's' : ''}?`,
      message: published
        ? 'Each selected guest will receive your faith-themed announcement with a link to your published wedding website.'
        : 'Your wedding website is not published yet, so the "Visit Our Wedding Website" link will land on a Coming Soon page. Publish it first, or send now and publish later.',
      confirmLabel: published ? 'Send now' : 'Send anyway',
      tone: published ? 'default' : 'danger',
    })) return
    sendMutation.mutate()
  }

  const sendMutation = useMutation({
    mutationFn: () =>
      apiClient.post(`/api/v1/save-the-dates/couple/${coupleId}/send`,
        selectedIds !== null ? { guestIds: selectedIds, idempotencyKey } : { idempotencyKey }
      ).then(r => r.data as SaveTheDateSendResult),
    onSuccess: (data) => {
      setResult(data)
      // Reset to the default (unsent) selection and refetch so the just-sent guests
      // pick up their "Sent" badge and drop out of the default recipient set.
      setSelectedIds(null)
      // Rotate the dedup key so the NEXT send is a new attempt. Resetting selection to null
      // above may leave the selectedIds effect a no-op (it was already null), so rotate here
      // too, otherwise a later default send would reuse this key and be replayed as a no-op.
      setIdempotencyKey(crypto.randomUUID())
      qc.invalidateQueries({ queryKey: ['guests', coupleId] })
      // Malformed addresses are the couple's to fix, so pop them up immediately.
      if (data.invalidEmails.length > 0) setShowInvalidModal(true)
      // Only celebrate (and show "Sent!") when something was actually queued.
      if (data.queued > 0) {
        setSent(true)
        confetti({
          particleCount: 180,
          spread: 90,
          origin: { y: 0.5 },
          colors: ['#d4af6a', '#3b2f2f', '#f5ede0', '#fbbf24', '#fde68a'],
        })
      }
    },
    // Without this, a rejected send (validation 400 or 5xx) just flipped the
    // button back with no feedback, so a couple could think nothing was wrong
    // while zero save-the-dates went out (issue #222).
    onError: (err: unknown) => toast.error(errorDetail(err)),
  })

  const coupleNames = user?.partnerOneName && user?.partnerTwoName
    ? `${user.partnerTwoName} & ${user.partnerOneName}`
    : 'The Couple'
  const weddingDate = website?.weddingDate ? formatWeddingDate(website.weddingDate) : 'Date TBD'
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
            Upload an image from Canva or any design tool (JPEG, PNG, or WebP, max {MAX_UPLOAD_LABEL}). It will appear at the top of every save-the-date email you send.
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
                    accept={IMAGE_ACCEPT}
                    className="sr-only"
                    disabled={uploadStdImage.isPending}
                    onChange={e => {
                      const f = e.target.files?.[0]
                      // Reset so picking the same file twice still fires onChange.
                      e.target.value = ''
                      // Convert HEIC/HEIF (the default iPhone format) to JPEG before
                      // upload, matching the empty-state ImageDropzone path. Without
                      // this the raw input silently rejected camera-roll photos.
                      if (f) void normalizeImageFile(f).then(handleStdImagePick)
                    }}
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
              onPick={handleStdImagePick}
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
                  <p className="text-xs text-stone-400 mt-1">JPEG, PNG, or WebP up to {MAX_UPLOAD_LABEL}</p>
                </>
              )}
            </ImageDropzone>
          )}
          {(stdImageError || uploadStdImage.isError) && (
            <p className="mt-2 text-xs text-red-600">
              {stdImageError ?? uploadErrorMessage(uploadStdImage.error, 'Upload failed. Check the file type and size and try again.')}
            </p>
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
                      onClick={() => setSelectedIds(emailGuests.map(g => g.id))}
                      className="text-amber-700 hover:underline"
                    >
                      All
                    </button>
                    {alreadySentCount > 0 && (
                      <button
                        onClick={() => setSelectedIds(null)}
                        className="text-amber-700 hover:underline"
                      >
                        Unsent
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedIds([])}
                      className="text-stone-500 hover:underline"
                    >
                      None
                    </button>
                  </div>
                </div>
                <div className="max-h-52 overflow-y-auto rounded-lg border border-stone-200 divide-y divide-stone-100">
                  {emailGuests.map(g => {
                    const badge = stdBadge(g.saveTheDateDeliveryStatus, g.saveTheDateSentAt)
                    const bounced = g.saveTheDateDeliveryStatus === 'BOUNCED' || g.saveTheDateDeliveryStatus === 'COMPLAINED'
                    return (
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
                        {badge && (
                          <span className={`ml-auto flex-shrink-0 inline-flex items-center gap-1 text-xs font-medium ${badge.cls}`}>
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                              {bounced
                                ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                : <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />}
                            </svg>
                            {badge.label}
                          </span>
                        )}
                      </label>
                    )
                  })}
                </div>
              </div>

              {website && !website.isPublished && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-2">
                      <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                      </svg>
                      <p className="text-sm text-amber-800">
                        Your wedding site is not published yet. Guests who click the link will see a Coming Soon page.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => publishSite.mutate(true)}
                      disabled={publishSite.isPending}
                      className="self-start whitespace-nowrap rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50 sm:self-auto"
                    >
                      {publishSite.isPending ? 'Publishing…' : 'Publish now'}
                    </button>
                  </div>
                  {publishSite.isError && (
                    <p className="mt-2 text-xs text-red-600">
                      Could not publish. Try again, or publish from the website editor.
                    </p>
                  )}
                </div>
              )}

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

          {result && (
            <div className={`p-3 rounded-lg text-sm ${result.queued > 0 ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-800'}`}>
              {result.queued > 0 ? (
                <>
                  Queued {result.queued} save-the-date{result.queued !== 1 ? 's' : ''}.{' '}
                  <Link to="/dashboard/guests" className="underline">View guest list</Link>
                </>
              ) : (
                <>No save-the-dates were sent.</>
              )}
              {(result.invalidCount > 0 || result.suppressedCount > 0) && (
                <ul className="mt-1.5 list-disc pl-5 space-y-0.5">
                  {result.invalidCount > 0 && (
                    <li>
                      {result.invalidCount} skipped (invalid email address).{' '}
                      <button
                        type="button"
                        onClick={() => setShowInvalidModal(true)}
                        className="underline font-medium"
                      >
                        View {result.invalidCount === 1 ? 'it' : 'them'}
                      </button>
                    </li>
                  )}
                  {result.suppressedCount > 0 && (
                    <li>{result.suppressedCount} skipped (guest unsubscribed).</li>
                  )}
                </ul>
              )}
              {result.queued > 0 && (
                <p className="mt-1.5 text-xs opacity-80">
                  Delivered and bounced confirmations will appear next to each guest as they arrive.
                </p>
              )}
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
          <p>· Send save-the-dates 6 to 12 months before the wedding for destination weddings, 4 to 6 months for local.</p>
          <p>· Make sure your wedding website is published before sending so guests can visit it.</p>
          <p>· Formal invitations with RSVP links can be sent separately from the Guest List page.</p>
        </div>
      </div>

      {showInvalidModal && result && result.invalidEmails.length > 0 && (
        <InvalidEmailsModal
          emails={result.invalidEmails}
          onClose={() => setShowInvalidModal(false)}
        />
      )}
    </div>
  )
}
