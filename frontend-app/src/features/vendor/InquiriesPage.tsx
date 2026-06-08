import { useVendorInquiries, useMarkInquiryRead } from './useInquiries'
import PageHeader from '@/components/PageHeader'

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
      <PageHeader title="Inquiries" backTo="/vendor" backLabel="Back to dashboard" maxWidth="max-w-2xl" />

      <main className="mx-auto max-w-2xl px-4 sm:px-6 py-6 sm:py-10">
        {unreadCount > 0 && (
          <p className="text-sm text-[#a08060] mb-6">
            {unreadCount} unread {unreadCount === 1 ? 'message' : 'messages'}
          </p>
        )}

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
                <p className="text-sm text-[#3b2f2f] whitespace-pre-line">{inquiry.message}</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
