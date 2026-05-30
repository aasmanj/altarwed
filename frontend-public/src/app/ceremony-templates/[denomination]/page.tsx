import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'
import {
  CEREMONY_GUIDES,
  getGuide,
  GUIDES_PUBLISHED_ISO,
  GUIDES_MODIFIED_ISO,
  GUIDES_IMAGE,
} from '@/app/ceremony-templates/data'

// Fully static: the content lives in data.ts, so every guide is prerendered at
// build and served from the CDN. generateStaticParams returns ONLY authored
// slugs, so unknown denominations 404 instead of rendering a thin page.
export function generateStaticParams() {
  return CEREMONY_GUIDES.map((g) => ({ denomination: g.slug }))
}

// Unknown slug -> 404 rather than an empty shell (no doorway pages).
export const dynamicParams = false

export async function generateMetadata(
  { params }: { params: Promise<{ denomination: string }> }
): Promise<Metadata> {
  const { denomination } = await params
  const guide = getGuide(denomination)
  if (!guide) return { title: 'Not Found | AltarWed' }

  const url = `https://www.altarwed.com/ceremony-templates/${guide.slug}`
  return {
    title: `${guide.metaTitle} | AltarWed`,
    description: guide.metaDescription,
    alternates: { canonical: url },
    openGraph: {
      title: `${guide.metaTitle} | AltarWed`,
      description: guide.metaDescription,
      url,
      siteName: 'AltarWed',
      type: 'article',
    },
  }
}

export default async function CeremonyTemplatePage(
  { params }: { params: Promise<{ denomination: string }> }
) {
  const { denomination } = await params
  const guide = getGuide(denomination)
  if (!guide) notFound()

  const url = `https://www.altarwed.com/ceremony-templates/${guide.slug}`

  // Article + Breadcrumb + FAQ structured data. Content is static and
  // author-controlled (no user input), so no escaping is required, but we keep
  // the same shape the blog uses for consistency.
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: guide.metaTitle,
      description: guide.metaDescription,
      image: [GUIDES_IMAGE],
      datePublished: GUIDES_PUBLISHED_ISO,
      dateModified: GUIDES_MODIFIED_ISO,
      inLanguage: 'en-US',
      author: { '@type': 'Organization', name: 'AltarWed', url: 'https://www.altarwed.com' },
      publisher: {
        '@type': 'Organization',
        name: 'AltarWed',
        url: 'https://www.altarwed.com',
        logo: { '@type': 'ImageObject', url: 'https://www.altarwed.com/icon.png' },
      },
      mainEntityOfPage: { '@type': 'WebPage', '@id': url },
      url,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.altarwed.com' },
        { '@type': 'ListItem', position: 2, name: 'Ceremony Templates', item: 'https://www.altarwed.com/ceremony-templates' },
        { '@type': 'ListItem', position: 3, name: guide.title, item: url },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: guide.faq.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
  ]

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SiteHeader />
      <main>
        {/* Header */}
        <section className="max-w-3xl mx-auto px-6 pt-12 pb-8">
          <nav aria-label="Breadcrumb" className="mb-6 text-sm text-[#a08060]">
            <Link href="/ceremony-templates" className="hover:text-[#3b2f2f] transition">
              ← All ceremony templates
            </Link>
          </nav>
          <span className="text-xs font-semibold uppercase tracking-widest text-[#a07840] bg-[#f5ede0] px-3 py-1 rounded-full">
            {guide.denomination}
          </span>
          <h1 className="mt-4 font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[#3b2f2f] leading-tight">
            {guide.title}
          </h1>
          <div className="mt-5 space-y-4">
            {guide.intro.map((p, i) => (
              <p key={i} className="text-lg text-[#5a4a3a] leading-relaxed">{p}</p>
            ))}
          </div>
          <p className="mt-5 text-sm text-[#a08060] border-t border-[#e8dcc8] pt-4">
            {guide.durationNote}
          </p>
        </section>

        {/* Order of service */}
        <section className="max-w-3xl mx-auto px-6 pb-4" aria-labelledby="order-heading">
          <h2 id="order-heading" className="font-serif text-2xl font-bold text-[#3b2f2f] mb-6">
            The order of service
          </h2>
          <ol className="space-y-5">
            {guide.order.map((item, i) => (
              <li key={i} className="flex gap-4">
                <span
                  aria-hidden="true"
                  className="shrink-0 w-8 h-8 rounded-full bg-[#3b2f2f] text-[#d4af6a] flex items-center justify-center text-sm font-semibold"
                >
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-semibold text-[#3b2f2f]">{item.step}</h3>
                  <p className="text-[#5a4a3a] text-sm leading-relaxed mt-1">{item.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Distinctives */}
        <section className="max-w-3xl mx-auto px-6 py-10" aria-labelledby="distinctives-heading">
          <h2 id="distinctives-heading" className="font-serif text-2xl font-bold text-[#3b2f2f] mb-6">
            What makes a {guide.denomination} wedding distinct
          </h2>
          <div className="grid sm:grid-cols-3 gap-5">
            {guide.distinctives.map((d, i) => (
              <div key={i} className="rounded-xl border border-[#e8dcc8] bg-white p-5">
                <h3 className="font-semibold text-[#3b2f2f] mb-2">{d.heading}</h3>
                <p className="text-[#5a4a3a] text-sm leading-relaxed">{d.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Scriptures */}
        <section className="bg-[#f5ede0] py-12" aria-labelledby="scripture-heading">
          <div className="max-w-3xl mx-auto px-6">
            <h2 id="scripture-heading" className="font-serif text-2xl font-bold text-[#3b2f2f] mb-6">
              Common scripture readings
            </h2>
            <ul className="space-y-4">
              {guide.scriptures.map((s, i) => (
                <li key={i} className="flex gap-3">
                  <span className="text-[#d4af6a] shrink-0" aria-hidden="true">✦</span>
                  <span>
                    <span className="font-semibold text-[#3b2f2f]">{s.ref}</span>
                    <span className="text-[#5a4a3a] text-sm"> {s.note}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-[#6b5344]">
              Looking for more options? See our{' '}
              <Link href="/blog/bible-verses-for-weddings" className="text-[#a07840] font-semibold hover:underline">
                40 Bible verses for your wedding ceremony
              </Link>.
            </p>
          </div>
        </section>

        {/* Music */}
        <section className="max-w-3xl mx-auto px-6 py-10" aria-labelledby="music-heading">
          <h2 id="music-heading" className="font-serif text-2xl font-bold text-[#3b2f2f] mb-4">
            Music notes
          </h2>
          <p className="text-[#5a4a3a] leading-relaxed">{guide.musicNote}</p>
          <p className="mt-4 text-sm text-[#6b5344]">
            For song ideas by moment, see our guide to{' '}
            <Link href="/blog/christian-wedding-songs" className="text-[#a07840] font-semibold hover:underline">
              Christian wedding songs
            </Link>{' '}
            and{' '}
            <Link href="/blog/christian-unity-ceremony-ideas" className="text-[#a07840] font-semibold hover:underline">
              unity ceremony ideas
            </Link>.
          </p>
        </section>

        {/* FAQ */}
        <section className="bg-[#fdfaf6] border-y border-[#e8dcc8] py-12" aria-labelledby="faq-heading">
          <div className="max-w-3xl mx-auto px-6">
            <h2 id="faq-heading" className="font-serif text-2xl font-bold text-[#3b2f2f] mb-6">
              Frequently asked questions
            </h2>
            <dl className="space-y-6">
              {guide.faq.map((f, i) => (
                <div key={i}>
                  <dt className="font-semibold text-[#3b2f2f]">{f.q}</dt>
                  <dd className="text-[#5a4a3a] text-sm leading-relaxed mt-1">{f.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* CTA into the ceremony builder */}
        <section className="bg-[#3b2f2f] py-14">
          <div className="max-w-2xl mx-auto px-6 text-center">
            <p className="text-[#d4af6a] text-xl mb-3" aria-hidden="true">✦</p>
            <h2 className="font-serif text-2xl font-bold text-white mb-3">
              Build your {guide.denomination} ceremony for free
            </h2>
            <p className="text-white/70 mb-7 text-sm">
              AltarWed gives every couple a free ceremony builder. Start from this order of service, customize each section, and share the program with your wedding party.
            </p>
            <a
              href="https://app.altarwed.com/register?utm_source=ceremony-templates&utm_medium=referral&utm_campaign=ceremony-cta"
              className="inline-flex items-center px-7 py-3.5 rounded-xl bg-[#d4af6a] text-[#3b2f2f] font-bold hover:bg-[#e9c87f] transition shadow-md text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#3b2f2f]"
            >
              Start your ceremony free →
            </a>
          </div>
        </section>

        {/* Other denominations, internal linking */}
        <section className="max-w-4xl mx-auto px-6 py-14" aria-labelledby="others-heading">
          <h2 id="others-heading" className="font-serif text-2xl font-bold text-[#3b2f2f] mb-6">
            Other ceremony templates
          </h2>
          <div className="grid sm:grid-cols-2 gap-5">
            {CEREMONY_GUIDES.filter((g) => g.slug !== guide.slug).map((g) => (
              <Link
                key={g.slug}
                href={`/ceremony-templates/${g.slug}`}
                className="group block rounded-2xl border border-[#e8dcc8] bg-white p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
              >
                <span className="text-xs font-semibold uppercase tracking-widest text-[#a07840]">{g.denomination}</span>
                <h3 className="mt-2 font-serif text-lg font-semibold text-[#3b2f2f] group-hover:text-[#d4af6a] transition-colors">
                  {g.title}
                </h3>
              </Link>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
