import type { Metadata } from 'next'
import WaitlistForm from '@/components/WaitlistForm'

export const metadata: Metadata = {
  title: 'AltarWed — Christian Wedding Planning Platform | Join the Waitlist',
  description:
    'AltarWed is the faith-first wedding planning platform built for Christian couples. Find vendors who share your values, plan your ceremony around scripture, and celebrate your covenant. Join the waitlist today.',
  alternates: {
    canonical: 'https://www.altarwed.com',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'AltarWed',
  url: 'https://www.altarwed.com',
  description:
    'Faith-first wedding planning marketplace for Christian couples and vendors.',
  potentialAction: {
    '@type': 'SearchAction',
    target: 'https://www.altarwed.com/vendors?q={search_term_string}',
    'query-input': 'required name=search_term_string',
  },
}

const features = [
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z" />
      </svg>
    ),
    title: 'Faith-Aligned Vendors',
    description:
      'Every vendor on AltarWed is screened and profiles their faith. Find photographers, florists, venues, and officiants who understand that your wedding is a covenant, not just a celebration.',
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
      </svg>
    ),
    title: 'Denomination-Aware Planning',
    description:
      'Whether you\'re Baptist, Catholic, Presbyterian, or non-denominational, AltarWed tailors ceremony templates, vow guides, and vendor recommendations to your tradition.',
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      </svg>
    ),
    title: 'Scripture & Ceremony Tools',
    description:
      'A curated library of Bible verses, vow templates, and order-of-service guides. Build a ceremony that is authentically yours and authentically Christian.',
  },
]

const steps = [
  {
    number: '01',
    title: 'Tell us about your vision',
    description: 'Share your denomination, wedding date, and what faith means to your celebration.',
  },
  {
    number: '02',
    title: 'Discover aligned vendors',
    description: 'Browse photographers, florists, venues, and officiants who share your values — filtered by your city and tradition.',
  },
  {
    number: '03',
    title: 'Plan your covenant day',
    description: 'Build your ceremony with scripture, craft your vows, and coordinate every detail in one place.',
  },
]

const verses = [
  { text: 'Two are better than one, because they have a good return for their labor.', ref: 'Ecclesiastes 4:9' },
  { text: 'Love is patient, love is kind. It does not envy, it does not boast, it is not proud.', ref: '1 Corinthians 13:4' },
  { text: 'Therefore what God has joined together, let no one separate.', ref: 'Mark 10:9' },
]

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── Nav ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-ivory/90 backdrop-blur-sm border-b border-gold/10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="font-serif text-xl font-bold text-brown tracking-wide">
            AltarWed
          </a>
          <a
            href="#waitlist"
            className="hidden sm:inline-flex items-center px-4 py-2 rounded-lg bg-gold text-white text-sm font-semibold hover:bg-gold-dark transition shadow-sm"
          >
            Join the Waitlist
          </a>
        </div>
      </header>

      <main>
        {/* ── Hero ────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-hero-pattern">
          <div className="absolute inset-0 bg-gradient-to-b from-ivory via-ivory/95 to-ivory pointer-events-none" />
          <div className="relative max-w-4xl mx-auto px-6 pt-20 pb-24 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cream border border-gold/20 text-gold-dark text-xs font-semibold uppercase tracking-widest mb-8">
              <span>✦</span> Coming Soon <span>✦</span>
            </div>

            <h1 className="text-balance font-serif text-5xl sm:text-6xl lg:text-7xl font-bold text-brown leading-tight mb-6">
              Wedding Planning
              <br />
              <span className="text-gold">Built for Your Covenant</span>
            </h1>

            <p className="text-lg sm:text-xl text-brown/70 max-w-2xl mx-auto leading-relaxed mb-10 text-balance">
              AltarWed is the faith-first marketplace connecting Christian couples
              with vendors who share their values — because your wedding day is more
              than a party. It&apos;s a covenant before God.
            </p>

            <div id="waitlist" className="max-w-2xl mx-auto">
              <WaitlistForm />
            </div>

            <p className="mt-6 text-sm text-brown/40">
              Join <strong className="text-brown/60">1,200+ Christian couples</strong> already on the waitlist
            </p>
          </div>
        </section>

        {/* ── Scripture Banner ─────────────────────────────────────────── */}
        <section className="bg-brown py-10 overflow-hidden">
          <div className="flex animate-[scroll_30s_linear_infinite] whitespace-nowrap">
            {[...verses, ...verses].map((v, i) => (
              <span key={i} className="inline-flex items-center gap-6 px-8 text-cream/70 text-sm font-serif italic">
                <span className="text-gold">✦</span>
                &ldquo;{v.text}&rdquo;
                <span className="not-italic font-sans text-xs text-cream/40 uppercase tracking-widest">{v.ref}</span>
              </span>
            ))}
          </div>
        </section>

        {/* ── Problem ──────────────────────────────────────────────────── */}
        <section className="max-w-4xl mx-auto px-6 py-24 text-center">
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-brown mb-6 text-balance">
            Wedding platforms weren&apos;t built with your faith in mind
          </h2>
          <p className="text-brown/65 text-lg leading-relaxed max-w-2xl mx-auto text-balance">
            The big wedding sites treat your ceremony like any other event. They
            won&apos;t help you find a photographer who prays with their couples,
            a florist whose work is an act of worship, or an officiant grounded
            in your denomination&apos;s theology. AltarWed was built to fix that.
          </p>
        </section>

        {/* ── Features ─────────────────────────────────────────────────── */}
        <section className="bg-cream py-24" aria-labelledby="features-heading">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 id="features-heading" className="font-serif text-3xl sm:text-4xl font-bold text-brown mb-4">
                Everything you need, rooted in faith
              </h2>
              <p className="text-brown/60 text-lg max-w-xl mx-auto">
                From vendor discovery to ceremony design, every feature is built around what makes a Christian wedding unique.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {features.map((f) => (
                <div
                  key={f.title}
                  className="bg-ivory rounded-2xl p-8 border border-gold/10 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
                >
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gold/10 text-gold mb-5">
                    {f.icon}
                  </div>
                  <h3 className="font-serif text-xl font-semibold text-brown mb-3">{f.title}</h3>
                  <p className="text-brown/60 text-sm leading-relaxed">{f.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works ──────────────────────────────────────────────── */}
        <section className="max-w-5xl mx-auto px-6 py-24" aria-labelledby="how-heading">
          <div className="text-center mb-16">
            <h2 id="how-heading" className="font-serif text-3xl sm:text-4xl font-bold text-brown mb-4">
              How AltarWed works
            </h2>
            <p className="text-brown/60 text-lg max-w-xl mx-auto">
              Three simple steps to a wedding that honors your faith.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-10">
            {steps.map((s) => (
              <div key={s.number} className="text-center">
                <div className="font-serif text-5xl font-bold text-gold/25 mb-4">{s.number}</div>
                <h3 className="font-serif text-xl font-semibold text-brown mb-3">{s.title}</h3>
                <p className="text-brown/60 text-sm leading-relaxed">{s.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── For Vendors ──────────────────────────────────────────────── */}
        <section className="bg-brown text-ivory py-24">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gold/20 border border-gold/30 text-gold-light text-xs font-semibold uppercase tracking-widest mb-8">
              For Vendors
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold mb-6 text-balance">
              Reach couples who are looking for{' '}
              <span className="text-gold">exactly what you offer</span>
            </h2>
            <p className="text-ivory/65 text-lg leading-relaxed max-w-2xl mx-auto mb-10 text-balance">
              If your business is an expression of your faith, you deserve a
              platform that connects you with couples who value that. Join
              AltarWed as a vendor and get early-access pricing — locked in
              forever.
            </p>
            <a
              href="#waitlist"
              className="inline-flex items-center px-7 py-3.5 rounded-lg bg-gold text-white font-semibold hover:bg-gold-dark transition shadow-md text-sm"
            >
              Get early vendor access
            </a>
          </div>
        </section>

        {/* ── Second CTA ───────────────────────────────────────────────── */}
        <section className="max-w-3xl mx-auto px-6 py-24 text-center">
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-brown mb-4 text-balance">
            Be first to plan your wedding on AltarWed
          </h2>
          <p className="text-brown/60 text-lg mb-10 text-balance">
            We&apos;re launching soon. Join the waitlist for early access, founding-member pricing, and updates as we build.
          </p>
          <WaitlistForm className="max-w-2xl mx-auto" />
        </section>
      </main>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="border-t border-gold/10 bg-ivory">
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-brown/40">
          <div className="font-serif text-base font-bold text-brown/60">AltarWed</div>
          <p className="text-center">
            &copy; {new Date().getFullYear()} AltarWed. All rights reserved.
          </p>
          <div className="flex gap-5">
            <a href="/privacy" className="hover:text-brown/70 transition">Privacy</a>
            <a href="/terms" className="hover:text-brown/70 transition">Terms</a>
            <a href="mailto:hello@altarwed.com" className="hover:text-brown/70 transition">Contact</a>
          </div>
        </div>
      </footer>

    </>
  )
}
