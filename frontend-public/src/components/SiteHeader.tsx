import Link from 'next/link'

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[#e8dcc8] shadow-sm">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-6">

        {/* Logo */}
        <Link href="/" className="font-serif text-xl font-bold text-[#3b2f2f] shrink-0">
          AltarWed
        </Link>

        {/* Primary nav */}
        <nav className="hidden sm:flex items-center gap-1">
          <NavLink href="/vendors">Find Vendors</NavLink>
          <NavLink href="/find-wedding">Find a Wedding</NavLink>
          <NavLink href="/resources">Resources</NavLink>
          <NavLink href="https://www.altarwed.com/vendors?category=PHOTOGRAPHER">Photographers</NavLink>
          <NavLink href="https://www.altarwed.com/vendors?category=VENUE">Venues</NavLink>
          <NavLink href="https://www.altarwed.com/vendors?category=OFFICIANT">Officiants</NavLink>
        </nav>

        {/* CTAs */}
        <div className="flex items-center gap-3 shrink-0">
          <a
            href="https://app.altarwed.com/login"
            className="hidden sm:block text-sm font-medium text-[#6b5344] hover:text-[#3b2f2f] transition"
          >
            Sign in
          </a>
          <a
            href="https://app.altarwed.com/register"
            className="rounded-lg bg-[#3b2f2f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5c4033] transition"
          >
            Start planning
          </a>
          <a
            href="https://app.altarwed.com/register/vendor"
            className="hidden md:block rounded-lg border border-[#d4af6a] px-4 py-2 text-sm font-semibold text-[#3b2f2f] hover:bg-[#d4af6a]/10 transition"
          >
            List your business
          </a>
        </div>
      </div>
    </header>
  )
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-3 py-2 text-sm font-medium text-[#6b5344] hover:text-[#3b2f2f] rounded-lg hover:bg-[#fdfaf6] transition"
    >
      {children}
    </Link>
  )
}
