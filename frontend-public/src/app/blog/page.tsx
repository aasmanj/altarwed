import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'Blog — Christian Wedding Planning Guides | AltarWed',
  description:
    'Faith-based wedding planning articles: Bible verses for weddings, Christian vow examples, ceremony order guides, denomination-specific planning tips, and more.',
  alternates: { canonical: 'https://www.altarwed.com/blog' },
  openGraph: {
    title: 'Blog — Christian Wedding Planning Guides | AltarWed',
    description: 'Faith-based wedding planning articles for Christian couples.',
    url: 'https://www.altarwed.com/blog',
    siteName: 'AltarWed',
    type: 'website',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Blog',
  name: 'AltarWed Blog',
  url: 'https://www.altarwed.com/blog',
  description: 'Faith-based wedding planning guides for Christian couples.',
  publisher: { '@type': 'Organization', name: 'AltarWed', url: 'https://www.altarwed.com' },
}

interface Post {
  id: string
  slug: string
  title: string
  excerpt: string
  author: string
  publishedAt: string
  tags: string | null
  coverImage: string | null
}

async function getPosts(): Promise<Post[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL
  if (!apiUrl) return []
  try {
    const res = await fetch(`${apiUrl}/api/v1/blog/posts`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default async function BlogIndexPage() {
  const posts = await getPosts()

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SiteHeader />
      <main>
        <section className="max-w-4xl mx-auto px-6 pt-16 pb-6">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#f5ede0] border border-[#d4af6a]/30 text-[#a07840] text-xs font-semibold uppercase tracking-widest mb-6">
              <span>✦</span> Faith-First Planning
            </div>
            <h1 className="font-serif text-4xl sm:text-5xl font-bold text-[#3b2f2f] mb-4">
              Christian Wedding Planning Blog
            </h1>
            <p className="text-[#6b5344] text-lg max-w-xl mx-auto">
              Scripture for your ceremony, vow guides, denomination-specific planning tips, and more — written for couples who want their wedding to honor God.
            </p>
          </div>
        </section>

        <section className="max-w-4xl mx-auto px-6 pb-24">
          {posts.length === 0 ? (
            <div className="text-center py-20 text-[#a08060]">
              <p className="text-lg font-serif italic">Articles coming soon.</p>
              <p className="text-sm mt-2">Check back shortly — new posts are published weekly.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-8">
              {posts.map((post) => (
                <Link
                  key={post.id}
                  href={`/blog/${post.slug}`}
                  className="group block bg-white rounded-2xl border border-[#e8dcc8] shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all overflow-hidden"
                >
                  <div className="bg-[#f5ede0] px-6 py-8">
                    {post.tags && (
                      <span className="text-xs font-semibold uppercase tracking-widest text-[#a07840]">
                        {post.tags.split(',')[0].trim()}
                      </span>
                    )}
                  </div>
                  <div className="p-6">
                    <h2 className="font-serif text-lg font-semibold text-[#3b2f2f] mb-2 group-hover:text-[#d4af6a] transition-colors">
                      {post.title}
                    </h2>
                    <p className="text-[#6b5344] text-sm leading-relaxed mb-4">{post.excerpt}</p>
                    <div className="flex items-center justify-between text-xs text-[#a08060]">
                      <span>{post.author}</span>
                      {post.publishedAt && <span>{formatDate(post.publishedAt)}</span>}
                    </div>
                    <p className="mt-3 text-sm text-[#d4af6a] font-semibold">Read article →</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
