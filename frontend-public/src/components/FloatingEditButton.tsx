'use client'

// Floating "Edit your website" button shown on every public wedding page.
// Since auth lives on app.altarwed.com (separate domain, in-memory JWT),
// we cannot detect login state here. Instead we always show the button —
// the couple recognises their own site. Guests ignore it; it's subtle.
// Clicking sends them to the dashboard editor. If they're not logged in,
// the app redirects to /login automatically.

const APP_EDITOR_URL = 'https://app.altarwed.com/dashboard/website/editor'

export default function FloatingEditButton() {
  return (
    <a
      href={APP_EDITOR_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="
        fixed bottom-6 right-6 z-50
        inline-flex items-center gap-2
        bg-white/90 backdrop-blur-sm
        border border-[#e8dcc8]
        text-[#3b2f2f] text-xs font-medium
        px-3.5 py-2 rounded-full
        shadow-md hover:shadow-lg
        hover:bg-[#f5ede0] transition
        print:hidden
      "
      aria-label="Edit this wedding website"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" />
      </svg>
      Edit this website
    </a>
  )
}
