import { Link } from 'react-router-dom'
import { useVendorInquiries, useMarkInquiryRead } from './useInquiries'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function InquiriesPage() {
  const { data: inquiries = [], isLoading } = useVendorInquiries()
  const markRead = useMarkInquiryRead()

  const unreadCount = inquiries.filter(i => !i.isRead).length

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#fdfaf6] flex items-center justify-center">
        <p className="text-[#a08060] animate-pulse">Loading…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fdfaf6]">
      <header className="border-b border-[#e8dcc8] bg-white px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
        <span className="font-serif text-xl font-bold text-[#3b2f2f] shrink-0">AltarWed</span>
        <Link to="/vendor" className="shrink-0 text-sm text-[#a08060] hover:text-[#3b2f2f] transition">
          ← Dashboard
        </Link>
      </header>

      <main className="mx-auto max-w-2xl px-4 sm:px-6 py-6 sm:py-10">
        <div className="mb-6">
          <h1 className="font-serif text-2xl font-bold text-[#3b2f2f]">Inquiries</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-[#a08060] mt-1">
              {unreadCount} unread {unreadCount === 1 ? 'message' : 'messages'}
            </p>
          )}
        </div>

        {inquiries.length === 0 ? (
          <div className="rounded-2xl border border-[#e8dcc8] bg-white p-10 text-center">
            <p className="text-[#a08060]">No inquiries yet.</p>
            <p className="text-sm text-[#a08060] mt-1">
              When couples contact you through your listing, their messages will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {inquiries.map(inquiry => (
              <div
                key={inquiry.id}
                className={`rounded-2xl border bg-white p-5 transition ${
                  inquiry.isRead ? 'border-[#e8dcc8]' : 'border-[#d4af6a] shadow-sm'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <p className="font-semibold text-[#3b2f2f] text-sm">
                      {inquiry.coupleName}
                      {!inquiry.isRead && (
                        <>
                          <span className="ml-2 inline-block h-2 w-2 rounded-full bg-[#d4af6a]" aria-hidden="true" />
                          <span className="sr-only">Unread</span>
                        </>
                      )}
                    </p>
                    {inquiry.weddingDate && (
                      <p className="text-xs text-[#a08060]">Wedding date: {inquiry.weddingDate}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <time className="text-xs text-[#a08060]">{formatDate(inquiry.createdAt)}</time>
                    {!inquiry.isRead && (
                      <button
                        onClick={() => markRead.mutate(inquiry.id)}
                        disabled={markRead.isPending}
                        className="text-xs text-[#d4af6a] hover:text-[#a08060] transition"
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-sm text-[#3b2f2f] whitespace-pre-line mb-4">{inquiry.message}</p>
                <div className="flex items-center justify-between pt-3 border-t border-[#f0e8d8]">
                  <p className="text-xs text-[#a08060]">
                    Reply directly to the couple's email below. Your response goes straight to their inbox.
                  </p>
                  <a
                    href={`mailto:${inquiry.coupleEmail}?subject=Re: Your AltarWed inquiry`}
                    className="ml-4 shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-[#3b2f2f] px-4 py-2 text-xs font-semibold text-white hover:bg-[#5c4033] transition"
                  >
                    Reply to {inquiry.coupleEmail}
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
