import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'
import { CEREMONY_GUIDES } from './data'

export const metadata: Metadata = {
  title: 'Christian Wedding Ceremony Templates by Denomination | AltarWed',
  description:
    'Free Christian wedding ceremony order templates by denomination: Catholic, Baptist, and non-denominational, with the readings, traditions, and order of service for each.',
  alternates: { canonical: 'https://www.altarwed.com/ceremony-templates' },
  openGraph: {
    title: 'Christian Wedding Ceremony Templates by Denomination | AltarWed',
    description: 'Free Christian wedding ceremony order templates by denomination.',
    url: 'https://www.altarwed.com/ceremony-templates',
    siteName: 'AltarWed',
    type: 'website',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: 'Christian Wedding Ceremony Templates',
  url: 'https://www.altarwed.com/ceremony-templates',
  description: 'Christian wedding ceremony order templates organized by denomination.',
  publisher: { '@type': 'Organization', name: 'AltarWed', url: 'https://www.altarwed.com' },
  // ItemList of the authored guides strengthens the crawl signal: it tells
  // Google these URLs are the members of this collection, in order.
  mainEntity: {
    '@type': 'ItemList',
    itemListElement: CEREMONY_GUIDES.map((g, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: g.title,
      url: `https://www.altarwed.com/ceremony-templates/${g.slug}`,
    })),
  },
}

export default function CeremonyTemplatesIndex() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SiteHeader />
      <main>
        <section className="max-w-4xl mx-auto px-6 pt-16 pb-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#f5ede0] border border-[#d4af6a]/30 text-[#a07840] text-xs font-semibold uppercase tracking-widest mb-6">
            <span aria-hidden="true">✦</span> Ceremony Templates
          </div>
          <h1 className="font-serif text-4xl sm:text-5xl font-bold text-[#3b2f2f] mb-4">
            Christian Wedding Ceremony Templates
          </h1>
          <p className="text-[#6b5344] text-lg max-w-2xl mx-auto">
            A complete order of service for your tradition, with the readings, music, and customs that make each one distinct. Choose your denomination to see the full ceremony outline.
          </p>
        </section>

        <section className="max-w-4xl mx-auto px-6 pb-20">
          <div className="grid sm:grid-cols-2 gap-6">
            {CEREMONY_GUIDES.map((g) => (
              <Link
                key={g.slug}
                href={`/ceremony-templates/${g.slug}`}
                className="group block rounded-2xl border border-[#e8dcc8] bg-white p-7 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
              >
                <span className="text-xs font-semibold uppercase tracking-widest text-[#a07840]">{g.denomination}</span>
                <h2 className="mt-2 font-serif text-xl font-semibold text-[#3b2f2f] group-hover:text-[#d4af6a] transition-colors">
                  {g.title}
                </h2>
                <p className="mt-2 text-[#6b5344] text-sm leading-relaxed">{g.intro[0]}</p>
                <p className="mt-4 text-sm text-[#d4af6a] font-semibold">View the full order →</p>
              </Link>
            ))}
          </div>

          <p className="mt-10 text-center text-sm text-[#6b5344]">
            Want to build and share your own?{' '}
            <a
              href="https://app.altarwed.com/register?utm_source=ceremony-templates&utm_medium=referral&utm_campaign=ceremony-index"
              className="text-[#a07840] font-semibold hover:underline"
            >
              Create your free ceremony on AltarWed →
            </a>
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
