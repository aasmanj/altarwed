import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'

export const metadata: Metadata = {
  title: 'Resources for Christian Couples | AltarWed',
  description: 'Books, registries, and tools to help Christian couples build a faith-first marriage. Curated by AltarWed.',
  openGraph: {
    title: 'Resources for Christian Couples | AltarWed',
    description: 'Books, registries, and tools to help Christian couples build a faith-first marriage.',
    type: 'website',
  },
}

const BOOKS = [
  {
    title: 'The Meaning of Marriage',
    author: 'Timothy Keller',
    description: 'A deep, scripture-rooted exploration of covenant marriage. Keller weaves theology and practical wisdom — the most-recommended pre-marital book among pastors.',
    href: 'https://www.amazon.com/Meaning-Marriage-Facing-Realities-Profound/dp/1594631875?tag=altarwed-20',
    badge: 'Most recommended',
  },
  {
    title: 'The Five Love Languages',
    author: 'Gary Chapman',
    description: 'Understand how you and your partner give and receive love. A practical, widely-used framework for building a lasting marriage.',
    href: 'https://www.amazon.com/Five-Love-Languages-Secret-Lasts/dp/080241270X?tag=altarwed-20',
    badge: null,
  },
  {
    title: 'Sacred Marriage',
    author: 'Gary Thomas',
    description: 'What if God designed marriage to make us holy more than to make us happy? A transformative perspective on covenant commitment.',
    href: 'https://www.amazon.com/Sacred-Marriage-Revised-Updated-Relationship/dp/0310337372?tag=altarwed-20',
    badge: null,
  },
  {
    title: 'Love & War',
    author: 'John & Stasi Eldredge',
    description: 'An honest look at the beauty and hardship of marriage from a Christian perspective. Encouraging and grounding for engaged couples.',
    href: 'https://www.amazon.com/Love-War-Finding-Marriage-Dreamed/dp/0385529147?tag=altarwed-20',
    badge: null,
  },
]

const REGISTRIES = [
  {
    name: 'Amazon Wedding Registry',
    description: 'The most flexible option — millions of products, easy returns, and a universal registry feature that pulls from any store.',
    href: 'https://www.amazon.com/wedding/home?tag=altarwed-20',
    logo: '🛒',
  },
  {
    name: 'Target Wedding Registry',
    description: 'Great for everyday home essentials. Couples love the 15% completion discount and wide in-store availability.',
    href: 'https://www.target.com/gift-registry/wedding',
    logo: '🎯',
  },
  {
    name: 'Zola',
    description: 'Modern, beautiful registry experience. Supports cash funds, experiences, and traditional gifts all in one place.',
    href: 'https://www.zola.com/wedding-registry',
    logo: '✨',
  },
  {
    name: 'The Knot Registry',
    description: 'Universal registry that aggregates gifts from any store. Simple for guests to use.',
    href: 'https://www.theknot.com/registry',
    logo: '💍',
  },
]

export default function ResourcesPage() {
  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-[#fdfaf6]">
        {/* Hero */}
        <div className="bg-[#3b2f2f] py-14 px-6 text-center">
          <h1 className="font-serif text-4xl font-bold text-white mb-3">Resources for Couples</h1>
          <p className="text-[#e8dcc8] text-base max-w-xl mx-auto">
            Books, registries, and tools to help you build a faith-first marriage — curated by the AltarWed team.
          </p>
        </div>

        <div className="max-w-4xl mx-auto px-6 py-14 space-y-16">

          {/* Books */}
          <section>
            <div className="text-center mb-10">
              <h2 className="font-serif text-3xl font-bold text-[#3b2f2f] mb-2">Books We Recommend</h2>
              <p className="text-sm text-[#a08060]">Faith-rooted reads to prepare your hearts for marriage.</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-6">
              {BOOKS.map(book => (
                <a
                  key={book.title}
                  href={book.href}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  className="block rounded-2xl border border-[#e8dcc8] bg-white p-6 hover:border-[#d4af6a] hover:shadow-sm transition group"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="font-serif text-lg font-bold text-[#3b2f2f] group-hover:text-[#d4af6a] transition leading-snug">
                        {book.title}
                      </p>
                      <p className="text-xs text-[#a08060] mt-0.5">by {book.author}</p>
                    </div>
                    {book.badge && (
                      <span className="shrink-0 text-xs bg-[#d4af6a]/15 text-[#d4af6a] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">
                        {book.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[#6b5344] leading-relaxed">{book.description}</p>
                  <p className="mt-4 text-xs font-medium text-[#d4af6a] group-hover:underline">
                    View on Amazon →
                  </p>
                </a>
              ))}
            </div>
            <p className="mt-4 text-xs text-center text-[#a08060]">
              Affiliate disclosure: AltarWed earns a small commission on Amazon purchases at no extra cost to you.
            </p>
          </section>

          {/* Registries */}
          <section>
            <div className="text-center mb-10">
              <h2 className="font-serif text-3xl font-bold text-[#3b2f2f] mb-2">Wedding Registries</h2>
              <p className="text-sm text-[#a08060]">Set up your registry — you can link up to three on your AltarWed wedding website.</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {REGISTRIES.map(r => (
                <a
                  key={r.name}
                  href={r.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex gap-4 rounded-xl border border-[#e8dcc8] bg-white p-5 hover:border-[#d4af6a] hover:shadow-sm transition group"
                >
                  <span className="text-3xl shrink-0">{r.logo}</span>
                  <div>
                    <p className="font-semibold text-[#3b2f2f] group-hover:text-[#d4af6a] transition text-sm">{r.name}</p>
                    <p className="text-xs text-[#a08060] mt-1 leading-relaxed">{r.description}</p>
                  </div>
                </a>
              ))}
            </div>
          </section>

          {/* CTA */}
          <section className="rounded-2xl bg-[#3b2f2f] px-8 py-10 text-center">
            <p className="font-serif text-2xl font-bold text-white mb-2">Build your wedding website</p>
            <p className="text-[#e8dcc8] text-sm mb-6 max-w-sm mx-auto">
              Free, faith-first, and beautiful. Share your story, registry, and ceremony details in one place.
            </p>
            <a
              href="https://app.altarwed.com/register"
              className="inline-block rounded-xl bg-[#d4af6a] px-8 py-3 text-sm font-bold text-[#3b2f2f] hover:bg-[#c49d55] transition"
            >
              Start planning free
            </a>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
