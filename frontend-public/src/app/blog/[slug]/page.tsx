import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'

interface Post {
  id: string
  slug: string
  title: string
  excerpt: string
  content: string
  author: string
  publishedAt: string
  seoTitle: string | null
  seoDesc: string | null
  tags: string | null
  coverImage: string | null
  updatedAt: string
}

async function getPost(slug: string): Promise<Post | null> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/blog/posts/${slug}`, {
      next: { revalidate: 3600 },
    })
    if (res.status === 404) return null
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = await getPost(params.slug)
  if (!post) return { title: 'Not Found | AltarWed' }

  const title = post.seoTitle ?? post.title
  const description = post.seoDesc ?? post.excerpt
  const url = `https://www.altarwed.com/blog/${post.slug}`

  return {
    title: `${title} | AltarWed Blog`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${title} | AltarWed Blog`,
      description,
      url,
      siteName: 'AltarWed',
      type: 'article',
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      authors: [post.author],
    },
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default async function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = await getPost(params.slug)
  if (!post) notFound()

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    author: { '@type': 'Person', name: post.author },
    publisher: { '@type': 'Organization', name: 'AltarWed', url: 'https://www.altarwed.com' },
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    url: `https://www.altarwed.com/blog/${post.slug}`,
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SiteHeader />
      <main>
        {/* Header */}
        <section className="max-w-3xl mx-auto px-6 pt-14 pb-8">
          <div className="mb-6">
            <Link href="/blog" className="text-sm text-[#a08060] hover:text-[#3b2f2f] transition">
              ← Back to blog
            </Link>
          </div>
          {post.tags && (
            <div className="mb-4">
              <span className="text-xs font-semibold uppercase tracking-widest text-[#a07840] bg-[#f5ede0] px-3 py-1 rounded-full">
                {post.tags.split(',')[0].trim()}
              </span>
            </div>
          )}
          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[#3b2f2f] leading-tight mb-4">
            {post.title}
          </h1>
          <p className="text-lg text-[#6b5344] leading-relaxed mb-6">{post.excerpt}</p>
          <div className="flex items-center gap-3 text-sm text-[#a08060] border-t border-[#e8dcc8] pt-5">
            <span>By {post.author}</span>
            {post.publishedAt && (
              <>
                <span>·</span>
                <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
              </>
            )}
          </div>
        </section>

        {/* Article body */}
        <article className="max-w-3xl mx-auto px-6 pb-20">
          <div
            className="prose prose-stone prose-lg max-w-none
              prose-headings:font-serif prose-headings:text-[#3b2f2f]
              prose-p:text-[#5a4a3a] prose-p:leading-relaxed
              prose-a:text-[#d4af6a] prose-a:no-underline hover:prose-a:underline
              prose-blockquote:border-[#d4af6a] prose-blockquote:text-[#6b5344] prose-blockquote:font-serif prose-blockquote:italic
              prose-strong:text-[#3b2f2f]
              prose-li:text-[#5a4a3a]"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
        </article>

        {/* CTA */}
        <section className="bg-[#f5ede0] py-14">
          <div className="max-w-2xl mx-auto px-6 text-center">
            <p className="text-[#d4af6a] text-xl mb-3">✦</p>
            <h2 className="font-serif text-2xl font-bold text-[#3b2f2f] mb-3">
              Ready to start planning your Christian wedding?
            </h2>
            <p className="text-[#6b5344] mb-7 text-sm">
              Create your free wedding website, manage your guest list, and build your ceremony — all in one faith-first platform.
            </p>
            <a
              href="https://app.altarwed.com/register"
              className="inline-flex items-center px-7 py-3.5 rounded-xl bg-[#3b2f2f] text-white font-semibold hover:bg-[#5c4033] transition shadow-md text-sm"
            >
              Start planning free →
            </a>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
