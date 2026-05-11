import Link from 'next/link'

export default function SiteFooter() {
  return (
    <footer className="border-t border-[#e8dcc8] bg-[#fdfaf6] mt-16">
      <div className="max-w-6xl mx-auto px-6 py-12 grid sm:grid-cols-2 md:grid-cols-4 gap-8">

        <div>
          <p className="font-serif text-lg font-bold text-[#3b2f2f] mb-3">AltarWed</p>
          <p className="text-sm text-[#a08060] leading-relaxed">
            The faith-first wedding planning platform for Christian couples and vendors.
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#a08060] mb-3">For Couples</p>
          <ul className="space-y-2">
            <FooterLink href="https://app.altarwed.com/register">Start planning free</FooterLink>
            <FooterLink href="/vendors">Find vendors</FooterLink>
            <FooterLink href="https://app.altarwed.com/login">Sign in</FooterLink>
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#a08060] mb-3">For Vendors</p>
          <ul className="space-y-2">
            <FooterLink href="https://app.altarwed.com/register/vendor">List your business</FooterLink>
            <FooterLink href="/vendors">Browse directory</FooterLink>
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#a08060] mb-3">Browse</p>
          <ul className="space-y-2">
            <FooterLink href="/vendors?category=PHOTOGRAPHER">Photographers</FooterLink>
            <FooterLink href="/vendors?category=VENUE">Venues</FooterLink>
            <FooterLink href="/vendors?category=OFFICIANT">Officiants</FooterLink>
            <FooterLink href="/vendors?category=FLORIST">Florists</FooterLink>
            <FooterLink href="/vendors?category=COORDINATOR">Coordinators</FooterLink>
          </ul>
        </div>
      </div>

      <div className="border-t border-[#e8dcc8] px-6 py-4 flex flex-wrap gap-x-6 gap-y-1 justify-center">
        <Link href="/resources" className="text-xs text-[#a08060] hover:text-[#3b2f2f] transition">Resources</Link>
        <Link href="/find-wedding" className="text-xs text-[#a08060] hover:text-[#3b2f2f] transition">Find a Wedding</Link>
        <Link href="/privacy" className="text-xs text-[#a08060] hover:text-[#3b2f2f] transition">Privacy Policy</Link>
        <Link href="/terms" className="text-xs text-[#a08060] hover:text-[#3b2f2f] transition">Terms of Service</Link>
      </div>

      <div className="border-t border-[#e8dcc8] py-4 text-center text-xs text-[#a08060]">
        © {new Date().getFullYear()} AltarWed · Faith-first wedding planning
      </div>
    </footer>
  )
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="text-sm text-[#6b5344] hover:text-[#3b2f2f] transition">
        {children}
      </Link>
    </li>
  )
}
