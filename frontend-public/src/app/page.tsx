import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'

export const metadata: Metadata = {
  title: 'AltarWed — Christian Wedding Planning Platform',
  description:
    'Plan your Christian wedding with faith-aligned vendors, a free shareable wedding website, guest management, ceremony builder, and more. Built for covenant couples.',
  alternates: {
    canonical: 'https://www.altarwed.com',
  },
  openGraph: {
    title: 'AltarWed — Christian Wedding Planning Platform',
    description:
      'Plan your Christian wedding with faith-aligned vendors, a free shareable wedding website, guest management, ceremony builder, and more.',
    url: 'https://www.altarwed.com',
    siteName: 'AltarWed',
    type: 'website',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'AltarWed',
  url: 'https://www.altarwed.com',
  description: 'Faith-first wedding planning marketplace for Christian couples and vendors.',
  potentialAction: {
    '@type': 'SearchAction',
    target: 'https://www.altarwed.com/vendors?q={search_term_string}',
    'query-input': 'required name=search_term_string',
  },
}

const features = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z" />
      </svg>
    ),
    title: 'Free Wedding Website',
    description: 'Your own shareable page at altarwed.com/wedding/your-names. Share your story, registry, travel details, and prayer wall.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
    title: 'Guest List & RSVP',
    description: 'Manage your guest list, send RSVP links, track meal preferences, and coordinate seating — all in one place.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
      </svg>
    ),
    title: 'Ceremony Builder',
    description: 'Build your order of service with 12 section types. Start from a classic Christian template or customize from scratch.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
      </svg>
    ),
    title: 'Vow Builder',
    description: 'Craft your vows with writing prompts, scripture shortcuts, and a private side-by-side preview for both partners.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      </svg>
    ),
    title: 'Scripture Browser',
    description: 'Search and pin Bible verses to your wedding website. Browse curated verses or search by book, topic, or keyword.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
      </svg>
    ),
    title: 'Budget Tracker',
    description: 'Track estimated vs. actual costs by category, mark vendors paid, and stay on budget — all in your dashboard.',
  },
]

const steps = [
  {
    number: '01',
    title: 'Create your free account',
    description: 'Sign up in under a minute. No credit card, no commitments — just your names and wedding date.',
  },
  {
    number: '02',
    title: 'Build your wedding website',
    description: 'Add your story, upload photos, pin scripture, and share the link with your guests. It\'s live immediately.',
  },
  {
    number: '03',
    title: 'Plan every detail in one place',
    description: 'Guest list, RSVP, ceremony order, vows, budget, seating — every tool your covenant day needs.',
  },
]

const verses = [
  { text: 'Two are better than one, because they have a good return for their labor.', ref: 'Ecclesiastes 4:9' },
  { text: 'Love is patient, love is kind. It does not envy, it does not boast, it is not proud.', ref: '1 Corinthians 13:4' },
  { text: 'Therefore what God has joined together, let no one separate.', ref: 'Mark 10:9' },
  { text: 'And over all these virtues put on love, which binds them all together in perfect unity.', ref: 'Colossians 3:14' },
]

const testimonials = [
  {
    quote: 'AltarWed gave us a beautiful wedding website in minutes. Having scripture woven through every tool reminded us what our day was really about.',
    name: 'Jordan & Eden-Faith',
    detail: 'Getting married September 2025',
  },
]

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <SiteHeader />

      <main>
        {/* ── Hero ────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-[#fdfaf6]">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(212,175,106,0.08)_0%,_transparent_70%)] pointer-events-none" />
          <div className="relative max-w-4xl mx-auto px-6 pt-20 pb-24 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#f5ede0] border border-[#d4af6a]/30 text-[#a07840] text-xs font-semibold uppercase tracking-widest mb-8">
              <span>✦</span> Now Live — Free for Couples <span>✦</span>
            </div>

            <h1 className="text-balance font-serif text-5xl sm:text-6xl lg:text-7xl font-bold text-[#3b2f2f] leading-tight mb-6">
              Your Christian wedding
              <br />
              <span className="text-[#d4af6a]">starts here</span>
            </h1>

            <p className="text-lg sm:text-xl text-[#6b5344] max-w-2xl mx-auto leading-relaxed mb-10 text-balance">
              AltarWed gives every Christian couple a free wedding website, guest management,
              ceremony builder, vow writer, and faith-aligned vendor directory — because your
              wedding day is a covenant, not just an event.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="https://app.altarwed.com/register"
                className="inline-flex items-center justify-center px-8 py-4 rounded-xl bg-[#3b2f2f] text-white text-base font-semibold hover:bg-[#5c4033] transition shadow-md"
              >
                Start planning — it&apos;s free
              </a>
              <Link
                href="/vendors"
                className="inline-flex items-center justify-center px-8 py-4 rounded-xl border border-[#d4af6a] text-[#3b2f2f] text-base font-semibold hover:bg-[#d4af6a]/10 transition"
              >
                Browse Christian vendors
              </Link>
            </div>

            <p className="mt-6 text-sm text-[#a08060]">
              Free forever for couples &middot; No credit card required
            </p>
          </div>
        </section>

        {/* ── Scripture Banner ─────────────────────────────────────────── */}
        <section className="bg-[#3b2f2f] py-10 overflow-hidden">
          <div className="flex animate-[scroll_40s_linear_infinite] whitespace-nowrap">
            {[...verses, ...verses].map((v, i) => (
              <span key={i} className="inline-flex items-center gap-6 px-8 text-[#e8dcc8]/60 text-sm font-serif italic">
                <span className="text-[#d4af6a]">✦</span>
                &ldquo;{v.text}&rdquo;
                <span className="not-italic font-sans text-xs text-[#e8dcc8]/30 uppercase tracking-widest">{v.ref}</span>
              </span>
            ))}
          </div>
        </section>

        {/* ── Product showcase ─────────────────────────────────────────── */}
        <section className="max-w-6xl mx-auto px-6 py-24">
          <div className="text-center mb-16">
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#3b2f2f] mb-4">
              Your wedding website, live in minutes
            </h2>
            <p className="text-[#6b5344] text-lg max-w-xl mx-auto">
              Every couple gets a shareable page at <span className="font-mono text-sm bg-[#f5ede0] px-2 py-0.5 rounded text-[#3b2f2f]">altarwed.com/wedding/your-names</span> — free, forever.
            </p>
          </div>

          {/* Mock wedding website card */}
          <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-[#e8dcc8]">
            {/* Hero area */}
            <div className="bg-gradient-to-br from-[#3b2f2f] to-[#5c4033] px-8 py-14 text-center text-white">
              <p className="text-[#d4af6a] text-sm font-serif italic mb-2">Two becoming one</p>
              <h3 className="font-serif text-3xl sm:text-4xl font-bold mb-2">Jordan &amp; Eden-Faith</h3>
              <p className="text-[#e8dcc8]/70 text-sm">September 13, 2025 · Fredericksburg, VA</p>
              <p className="text-[#d4af6a]/80 text-xs font-serif italic mt-3">&ldquo;And over all these virtues put on love.&rdquo; — Col 3:14</p>
            </div>

            {/* Tab nav mockup */}
            <div className="border-b border-[#e8dcc8] px-4 flex gap-1 overflow-x-auto bg-[#fdfaf6]">
              {['Our Story', 'Details', 'Wedding Party', 'Registry', 'Travel', 'Prayer Wall'].map((tab, i) => (
                <span
                  key={tab}
                  className={`px-4 py-3 text-sm font-medium whitespace-nowrap ${i === 0 ? 'border-b-2 border-[#d4af6a] text-[#3b2f2f]' : 'text-[#a08060]'}`}
                >
                  {tab}
                </span>
              ))}
            </div>

            {/* Sample content */}
            <div className="px-8 py-8 bg-[#fdfaf6]">
              <h4 className="font-serif text-xl font-semibold text-[#3b2f2f] mb-3">Our Story</h4>
              <p className="text-[#6b5344] text-sm leading-relaxed mb-6">
                We met at a college ministry retreat in 2021 and knew from our first conversation that God had brought us together. Our faith has been the foundation of our relationship, and we can&apos;t wait to make that covenant before Him and our community.
              </p>
              <div className="flex gap-3">
                <span className="px-4 py-2 bg-[#3b2f2f] text-white text-sm rounded-lg font-medium">RSVP Now</span>
                <span className="px-4 py-2 border border-[#d4af6a] text-[#3b2f2f] text-sm rounded-lg font-medium">Submit a Prayer</span>
              </div>
            </div>
          </div>

          <p className="text-center mt-6 text-sm text-[#a08060]">
            <a href="https://app.altarwed.com/register" className="text-[#d4af6a] font-semibold hover:underline">
              Create yours free →
            </a>
          </p>
        </section>

        {/* ── Features grid ─────────────────────────────────────────────── */}
        <section className="bg-[#f5ede0] py-24" aria-labelledby="features-heading">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 id="features-heading" className="font-serif text-3xl sm:text-4xl font-bold text-[#3b2f2f] mb-4">
                Everything your covenant day needs
              </h2>
              <p className="text-[#6b5344] text-lg max-w-xl mx-auto">
                From vendor discovery to vow writing, every feature is built around what makes a Christian wedding unique.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((f) => (
                <div
                  key={f.title}
                  className="bg-white rounded-2xl p-7 border border-[#e8dcc8] shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
                >
                  <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-[#d4af6a]/10 text-[#d4af6a] mb-4">
                    {f.icon}
                  </div>
                  <h3 className="font-serif text-lg font-semibold text-[#3b2f2f] mb-2">{f.title}</h3>
                  <p className="text-[#6b5344] text-sm leading-relaxed">{f.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works ──────────────────────────────────────────────── */}
        <section className="max-w-5xl mx-auto px-6 py-24" aria-labelledby="how-heading">
          <div className="text-center mb-16">
            <h2 id="how-heading" className="font-serif text-3xl sm:text-4xl font-bold text-[#3b2f2f] mb-4">
              Up and running in minutes
            </h2>
            <p className="text-[#6b5344] text-lg max-w-xl mx-auto">
              No setup fees, no contracts, no waiting. Your wedding dashboard is ready the moment you sign up.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-10">
            {steps.map((s) => (
              <div key={s.number} className="text-center">
                <div className="font-serif text-5xl font-bold text-[#d4af6a]/25 mb-4">{s.number}</div>
                <h3 className="font-serif text-xl font-semibold text-[#3b2f2f] mb-3">{s.title}</h3>
                <p className="text-[#6b5344] text-sm leading-relaxed">{s.description}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-14">
            <a
              href="https://app.altarwed.com/register"
              className="inline-flex items-center px-8 py-4 rounded-xl bg-[#d4af6a] text-white font-semibold hover:bg-[#b8943a] transition shadow-md"
            >
              Create your free account →
            </a>
          </div>
        </section>

        {/* ── Testimonial ──────────────────────────────────────────────── */}
        <section className="bg-[#fdfaf6] py-16 border-y border-[#e8dcc8]">
          <div className="max-w-3xl mx-auto px-6 text-center">
            {testimonials.map((t) => (
              <div key={t.name}>
                <div className="text-[#d4af6a] text-2xl mb-4">✦ ✦ ✦</div>
                <blockquote className="font-serif text-xl sm:text-2xl text-[#3b2f2f] italic leading-relaxed mb-6">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <p className="text-sm font-semibold text-[#6b5344]">{t.name}</p>
                <p className="text-xs text-[#a08060]">{t.detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Vendor Directory ─────────────────────────────────────────── */}
        <section className="max-w-6xl mx-auto px-6 py-24">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#f5ede0] border border-[#d4af6a]/30 text-[#a07840] text-xs font-semibold uppercase tracking-widest mb-6">
                Vendor Directory
              </div>
              <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#3b2f2f] mb-5">
                Find vendors who pray with their couples
              </h2>
              <p className="text-[#6b5344] text-lg leading-relaxed mb-8">
                Every vendor on AltarWed is faith-profiled. Find photographers, venues, florists, officiants, and coordinators who understand that your wedding is a covenant before God — not just a party.
              </p>
              <div className="flex flex-wrap gap-3">
                {['Photographers', 'Venues', 'Officiants', 'Florists', 'Coordinators'].map((cat) => (
                  <Link
                    key={cat}
                    href={`/vendors?category=${cat.toUpperCase().replace('S', '')}`}
                    className="px-4 py-2 rounded-full border border-[#d4af6a] text-sm text-[#3b2f2f] hover:bg-[#d4af6a]/10 transition font-medium"
                  >
                    {cat}
                  </Link>
                ))}
              </div>
              <div className="mt-8">
                <Link href="/vendors" className="text-[#d4af6a] font-semibold hover:underline">
                  Browse all vendors →
                </Link>
              </div>
            </div>

            {/* Vendor card mockup */}
            <div className="bg-white rounded-2xl border border-[#e8dcc8] shadow-md overflow-hidden">
              <div className="bg-[#f5ede0] h-32 flex items-center justify-center">
                <svg className="w-10 h-10 text-[#d4af6a]/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                </svg>
              </div>
              <div className="p-6">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-semibold text-[#3b2f2f]">Grace Light Photography</h4>
                    <p className="text-xs text-[#a08060]">Photographer · Fredericksburg, VA</p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[#d4af6a]/10 text-[#a07840] font-medium border border-[#d4af6a]/20">Christian-owned</span>
                </div>
                <p className="text-sm text-[#6b5344] leading-relaxed">
                  We pray with every couple before the ceremony. Capturing covenant moments is our ministry.
                </p>
                <div className="mt-4 pt-4 border-t border-[#e8dcc8] flex items-center justify-between">
                  <span className="text-xs text-[#a08060]">Baptist · Non-denominational</span>
                  <span className="text-sm text-[#d4af6a] font-semibold">View listing →</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── For Vendors ──────────────────────────────────────────────── */}
        <section className="bg-[#3b2f2f] text-white py-24">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#d4af6a]/20 border border-[#d4af6a]/30 text-[#d4af6a] text-xs font-semibold uppercase tracking-widest mb-8">
              For Vendors
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold mb-6 text-balance">
              Reach couples looking for{' '}
              <span className="text-[#d4af6a]">exactly what you offer</span>
            </h2>
            <p className="text-white/65 text-lg leading-relaxed max-w-2xl mx-auto mb-10 text-balance">
              If your business is an expression of your faith, you belong on AltarWed.
              List your business free and connect with Christian couples who are actively looking for vendors who share their values.
            </p>
            <a
              href="https://app.altarwed.com/register/vendor"
              className="inline-flex items-center px-7 py-3.5 rounded-lg bg-[#d4af6a] text-white font-semibold hover:bg-[#b8943a] transition shadow-md text-sm"
            >
              List your business free →
            </a>
          </div>
        </section>

        {/* ── Blog teaser ──────────────────────────────────────────────── */}
        <section className="max-w-6xl mx-auto px-6 py-24">
          <div className="text-center mb-12">
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#3b2f2f] mb-4">
              Planning resources for Christian couples
            </h2>
            <p className="text-[#6b5344] text-lg max-w-xl mx-auto">
              Scripture for your ceremony, Christian vow examples, denomination guides, and more.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                href: '/blog/bible-verses-for-weddings',
                tag: 'Scripture',
                title: '40 Bible Verses for Your Wedding Ceremony',
                excerpt: 'The most meaningful scripture for Christian weddings, organized by theme: covenant, love, unity, and blessing.',
              },
              {
                href: '/blog/christian-wedding-vows',
                tag: 'Vows',
                title: 'Christian Wedding Vow Examples & Templates',
                excerpt: 'Traditional and modern vow templates rooted in scripture. Customize them for your denomination and your story.',
              },
              {
                href: '/blog/christian-wedding-ceremony-order',
                tag: 'Ceremony',
                title: 'A Classic Christian Wedding Ceremony Order',
                excerpt: 'A complete processional-to-recessional guide for a Christ-centered ceremony, with variations by denomination.',
              },
            ].map((post) => (
              <Link
                key={post.href}
                href={post.href}
                className="group block bg-white rounded-2xl border border-[#e8dcc8] shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all overflow-hidden"
              >
                <div className="bg-[#f5ede0] px-6 py-8">
                  <span className="text-xs font-semibold uppercase tracking-widest text-[#a07840]">{post.tag}</span>
                </div>
                <div className="p-6">
                  <h3 className="font-serif text-lg font-semibold text-[#3b2f2f] mb-2 group-hover:text-[#d4af6a] transition-colors">
                    {post.title}
                  </h3>
                  <p className="text-[#6b5344] text-sm leading-relaxed">{post.excerpt}</p>
                  <p className="mt-4 text-sm text-[#d4af6a] font-semibold">Read article →</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Final CTA ────────────────────────────────────────────────── */}
        <section className="bg-[#f5ede0] py-24">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <div className="text-[#d4af6a] text-2xl mb-6">✦</div>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#3b2f2f] mb-4 text-balance">
              Start planning your covenant day
            </h2>
            <p className="text-[#6b5344] text-lg mb-10 text-balance">
              Create your free wedding website and planning dashboard in minutes. No credit card required.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="https://app.altarwed.com/register"
                className="inline-flex items-center justify-center px-8 py-4 rounded-xl bg-[#3b2f2f] text-white text-base font-semibold hover:bg-[#5c4033] transition shadow-md"
              >
                Start planning free
              </a>
              <a
                href="https://app.altarwed.com/register/vendor"
                className="inline-flex items-center justify-center px-8 py-4 rounded-xl border border-[#3b2f2f] text-[#3b2f2f] text-base font-semibold hover:bg-[#3b2f2f]/5 transition"
              >
                List your business
              </a>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  )
}
