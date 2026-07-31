import Link from 'next/link'

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[#e8dcc8] shadow-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3 sm:gap-6">

        {/* Logo */}
        <Link href="/" className="font-serif text-xl font-bold text-[#3b2f2f] shrink-0">
          AltarWed
        </Link>

        {/* Primary nav. lg breakpoint, not sm: one row of logo + nav + CTAs
            only fits from ~1024px; at tablet widths (640-1023, incl. iPad
            portrait) it overflowed the viewport and forced horizontal scroll. */}
        <nav aria-label="Primary" className="hidden lg:flex items-center gap-1">
          <NavLink href="/find-wedding">Find a Wedding</NavLink>
          <NavLink href="/vendors">Find Vendors</NavLink>
          <NavLink href="/blog">Blog</NavLink>
          <NavLink href="/resources">Resources</NavLink>
          <NavLink href="/for-vendors">For Vendors</NavLink>
        </nav>

        {/* CTAs. One row of logo + both CTAs must fit a 320px viewport, so the
            full nav lives in its own scrollable row below on mobile. */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <a
            href="https://app.altarwed.com/login"
            className="text-sm font-medium text-[#6b5344] hover:text-[#3b2f2f] transition"
          >
            Sign in
          </a>
          <a
            href="https://app.altarwed.com/register"
            className="rounded-lg bg-[#3b2f2f] px-3 sm:px-4 py-2 text-sm font-semibold text-white hover:bg-[#5c4033] transition whitespace-nowrap"
          >
            Start planning
          </a>
          {/* xl, not md: below xl this outline CTA is redundant with the nav's
              For Vendors link and its width made the lg row wrap awkwardly. */}
          <Link
            href="/for-vendors"
            className="hidden xl:block rounded-lg border border-[#d4af6a] px-4 py-2 text-sm font-semibold text-[#3b2f2f] hover:bg-[#d4af6a]/10 transition"
          >
            For vendors
          </Link>
        </div>
      </div>

      {/* Mobile nav: its own horizontally scrollable row so the header never
          forces the page wider than the viewport (the old single-row layout
          overflowed every marketing page on phones). scrollbar-none keeps
          touch swipe + keyboard scroll without a visible scrollbar, same
          pattern as the wedding-page tab nav. lg:hidden must stay the exact
          inverse of the primary nav's hidden lg:flex: both carry
          aria-label="Primary", which is only valid because at most one is in
          the accessibility tree at any breakpoint. */}
      <nav aria-label="Primary" className="lg:hidden border-t border-[#f0e7d8] overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-1 px-3 py-1 whitespace-nowrap">
          <NavLink href="/find-wedding">Find a Wedding</NavLink>
          <NavLink href="/vendors">Find Vendors</NavLink>
          <NavLink href="/blog">Blog</NavLink>
          <NavLink href="/resources">Resources</NavLink>
          <NavLink href="/for-vendors">For Vendors</NavLink>
        </div>
      </nav>
    </header>
  )
}

function NavLink({ href, children, className = '' }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={`px-3 py-2 text-sm font-medium text-[#6b5344] hover:text-[#3b2f2f] rounded-lg hover:bg-[#fdfaf6] transition whitespace-nowrap ${className}`}
    >
      {children}
    </Link>
  )
}
