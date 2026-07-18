import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'

export const metadata: Metadata = {
  title: 'List Your Christian Wedding Business | AltarWed for Vendors',
  description:
    'Reach Christian couples actively planning their wedding. List free in the AltarWed vendor directory, or go Pro for priority placement and analytics.',
  alternates: { canonical: 'https://www.altarwed.com/for-vendors' },
  openGraph: {
    title: 'List Your Christian Wedding Business | AltarWed for Vendors',
    description:
      'Reach Christian couples actively planning their wedding. List free, or go Pro for priority placement and analytics.',
    url: 'https://www.altarwed.com/for-vendors',
    siteName: 'AltarWed',
    type: 'website',
  },
}

// ISR: this is a near-static marketing page, so revalidate slowly.
export const revalidate = 3600

const VENDOR_REGISTER_URL = 'https://app.altarwed.com/register/vendor'

// Value props sell the ROI a vendor gets, not just features. Each is framed around the
// three things that move the needle for a faith-aligned business: a warm audience, an
// SEO surface that compounds, and the tools to convert a browse into an inquiry.
const VALUE_PROPS = [
  {
    title: 'A warm, faith-aligned audience',
    description:
      'Every couple on AltarWed is a Christian couple actively planning a wedding. You reach people who are looking for exactly what you offer, not a cold general-market audience.',
  },
  {
    title: 'SEO reach that compounds',
    description:
      'Every couple gets a public wedding website that Google indexes, and the directory ranks for city and category searches. Your listing rides an organic-traffic engine that grows with every new couple.',
  },
  {
    title: 'Inquiries straight to your inbox',
    description:
      'Couples browse the directory by city and category, view your profile, and message you. Inquiries land in your dashboard inbox with an unread badge, so nothing slips through.',
  },
  {
    title: 'Show your faith up front',
    description:
      'A Christian-owned badge and denomination tags let couples see your values before they reach out, so the conversations you have are the right ones.',
  },
] as const

// Directory-reach proof points. These are structural facts about how the product works
// (not fabricated performance metrics), so they stay honest per the same FTC caution the
// homepage applies to testimonials: no invented numbers.
const REACH_PROOF = [
  {
    stat: 'Every couple',
    label: 'gets a public wedding website that links back into the directory you list in.',
  },
  {
    stat: 'City + category',
    label: 'search means couples find you by exactly the service and area you cover.',
  },
  {
    stat: 'Indexed by Google',
    label: 'so your listing keeps working for you long after you set it up.',
  },
] as const

interface Tier {
  name: string
  price: string
  cadence: string
  tagline: string
  features: string[]
  cta: string
  highlighted: boolean
}

// Pricing mirrors the live vendor billing in the dashboard: a free basic listing and a
// single Pro plan at $29/month (or $290/year, two months free). Keep these numbers in
// sync with frontend-app VendorSubscriptionPage so the public page never misquotes price.
const TIERS: Tier[] = [
  {
    name: 'Free listing',
    price: '$0',
    cadence: 'forever',
    tagline: 'Get discovered by Christian couples at no cost.',
    features: [
      'Listing in the vendor directory',
      'City and category search placement',
      'Christian-owned badge and denomination tags',
      'Inquiry inbox in your dashboard',
      'Logo and profile with photos',
    ],
    cta: 'List free',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$29',
    cadence: 'per month, or $290 per year',
    tagline: 'Stand out and see what is working.',
    features: [
      'Everything in Free listing',
      'Priority placement in city and category search',
      'Featured badge on your listing',
      'Profile views and inquiry analytics',
      'More photos and a richer profile',
    ],
    cta: 'Go Pro',
    highlighted: true,
  },
]

// Product + Offer JSON-LD so the pricing surfaces as structured data for search. The two
// tiers map to two Offers under a single "AltarWed Vendor Membership" product.
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'AltarWed Vendor Membership',
  description:
    'A directory listing that puts Christian wedding vendors in front of couples actively planning their wedding.',
  brand: { '@type': 'Brand', name: 'AltarWed' },
  url: 'https://www.altarwed.com/for-vendors',
  offers: [
    {
      '@type': 'Offer',
      name: 'Free listing',
      price: '0',
      priceCurrency: 'USD',
      url: VENDOR_REGISTER_URL,
      availability: 'https://schema.org/InStock',
    },
    {
      '@type': 'Offer',
      name: 'Pro',
      price: '29',
      priceCurrency: 'USD',
      url: VENDOR_REGISTER_URL,
      availability: 'https://schema.org/InStock',
    },
  ],
}

export default function ForVendorsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="bg-[#3b2f2f] text-white">
          <div className="max-w-4xl mx-auto px-6 pt-20 pb-24 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#d4af6a]/20 border border-[#d4af6a]/30 text-[#d4af6a] text-xs font-semibold uppercase tracking-widest mb-8">
              For Vendors
            </div>
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6 text-balance">
              List your Christian wedding business
            </h1>
            <p className="text-white/70 text-lg leading-relaxed max-w-2xl mx-auto mb-10 text-balance">
              AltarWed connects faith-aligned vendors with Christian couples who are actively
              planning their wedding. Start free, and upgrade when you are ready for more reach.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href={VENDOR_REGISTER_URL}
                className="inline-flex items-center justify-center px-8 py-4 rounded-xl bg-[#d4af6a] text-[#3b2f2f] text-base font-bold hover:bg-[#e9c87f] transition shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
              >
                List your business free
              </a>
              <Link
                href="/vendors"
                className="inline-flex items-center justify-center px-8 py-4 rounded-xl border border-white/60 text-white text-base font-semibold hover:bg-white/10 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                See the directory
              </Link>
            </div>
            <p className="mt-6 text-sm text-white/70">No credit card required to list free.</p>
          </div>
        </section>

        {/* Value props */}
        <section className="max-w-6xl mx-auto px-6 py-24" aria-labelledby="value-heading">
          <div className="text-center mb-16">
            <h2 id="value-heading" className="font-serif text-3xl sm:text-4xl font-bold text-[#3b2f2f] mb-4">
              Why vendors join AltarWed
            </h2>
            <p className="text-[#6b5344] text-lg max-w-xl mx-auto">
              A directory built for one audience: Christian couples who want vendors who share
              their faith.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            {VALUE_PROPS.map((prop) => (
              <div
                key={prop.title}
                className="bg-white rounded-2xl p-7 border border-[#e8dcc8] shadow-sm"
              >
                <h3 className="font-serif text-lg font-semibold text-[#3b2f2f] mb-2">{prop.title}</h3>
                <p className="text-[#6b5344] text-sm leading-relaxed">{prop.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Directory-reach proof */}
        <section className="bg-[#f5ede0] py-20" aria-labelledby="reach-heading">
          <div className="max-w-5xl mx-auto px-6">
            <div className="text-center mb-12">
              <h2 id="reach-heading" className="font-serif text-3xl sm:text-4xl font-bold text-[#3b2f2f] mb-4">
                An audience that keeps growing
              </h2>
              <p className="text-[#6b5344] text-lg max-w-2xl mx-auto">
                AltarWed is the SEO engine for Christian weddings. Every couple who joins makes the
                directory easier to find, and your listing benefits.
              </p>
            </div>
            <div className="grid sm:grid-cols-3 gap-6">
              {REACH_PROOF.map((item) => (
                <div
                  key={item.stat}
                  className="bg-white rounded-2xl p-7 border border-[#e8dcc8] shadow-sm text-center"
                >
                  <p className="font-serif text-xl font-bold text-[#d4af6a] mb-2">{item.stat}</p>
                  <p className="text-[#6b5344] text-sm leading-relaxed">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="max-w-5xl mx-auto px-6 py-24" aria-labelledby="pricing-heading">
          <div className="text-center mb-16">
            <h2 id="pricing-heading" className="font-serif text-3xl sm:text-4xl font-bold text-[#3b2f2f] mb-4">
              Simple, vendor-friendly pricing
            </h2>
            <p className="text-[#6b5344] text-lg max-w-xl mx-auto">
              Start free and only pay when you want more reach. No long-term commitment, cancel
              anytime.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {TIERS.map((tier) => (
              <div
                key={tier.name}
                className={`rounded-2xl p-8 border shadow-sm flex flex-col ${
                  tier.highlighted
                    ? 'bg-white border-[#d4af6a] ring-1 ring-[#d4af6a]'
                    : 'bg-white border-[#e8dcc8]'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-serif text-xl font-bold text-[#3b2f2f]">{tier.name}</h3>
                  {tier.highlighted && (
                    <span className="text-xs font-semibold text-[#a07840] bg-[#d4af6a]/10 px-2.5 py-0.5 rounded-full border border-[#d4af6a]/20">
                      Most popular
                    </span>
                  )}
                </div>
                <p className="text-[#8a6a4a] text-sm mb-5">{tier.tagline}</p>
                <div className="mb-6">
                  <span className="font-serif text-4xl font-bold text-[#3b2f2f]">{tier.price}</span>
                  <span className="text-[#8a6a4a] text-sm"> {tier.cadence}</span>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-sm text-[#6b5344]">
                      <span className="text-[#d4af6a] mt-0.5 shrink-0" aria-hidden="true">
                        &#10003;
                      </span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href={VENDOR_REGISTER_URL}
                  className={`inline-flex items-center justify-center px-6 py-3.5 rounded-xl text-base font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                    tier.highlighted
                      ? 'bg-[#d4af6a] text-[#3b2f2f] hover:bg-[#e9c87f] focus-visible:ring-[#d4af6a]'
                      : 'border border-[#3b2f2f] text-[#3b2f2f] hover:bg-[#3b2f2f]/5 focus-visible:ring-[#3b2f2f]'
                  }`}
                >
                  {tier.cta}
                </a>
              </div>
            ))}
          </div>

          <p className="text-center mt-8 text-sm text-[#8a6a4a]">
            Prices shown in USD. Pro billing is handled securely through Stripe, and you can cancel
            anytime from your billing portal.
          </p>
        </section>

        {/* Final CTA */}
        <section className="bg-[#3b2f2f] text-white py-24">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <div className="text-[#d4af6a] text-2xl mb-6" aria-hidden="true">
              &#10022;
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold mb-4 text-balance">
              Ready to reach Christian couples?
            </h2>
            <p className="text-white/70 text-lg mb-10 text-balance">
              If your business is an expression of your faith, you belong on AltarWed. Create your
              free listing in minutes.
            </p>
            <a
              href={VENDOR_REGISTER_URL}
              className="inline-flex items-center justify-center px-8 py-4 rounded-xl bg-[#d4af6a] text-[#3b2f2f] text-base font-bold hover:bg-[#e9c87f] transition shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#3b2f2f]"
            >
              List your business free
            </a>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  )
}
