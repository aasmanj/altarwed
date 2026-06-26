import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'
import { sanitizePostContent } from '@/lib/sanitizeHtml'

export const revalidate = 3600

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
  const apiUrl = process.env.NEXT_PUBLIC_API_URL
  if (!apiUrl) return null
  try {
    const res = await fetch(`${apiUrl}/api/v1/blog/posts/${slug}`, {
      // Match the SEO rule's 1h cache for blog content. Was 60s, which churned
      // the data cache and the rendered HTML far more often than blog posts
      // actually change.
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(10000),
    })
    if (res.status === 404) return null
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

// Other published posts for the "Related articles" block. Internal links between
// topically-related posts are one of the strongest on-site SEO signals: they
// spread crawl depth and link equity and tell Google these pages form a cluster
// around "christian wedding planning".
async function getRelatedPosts(currentSlug: string): Promise<Post[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL
  if (!apiUrl) return []
  try {
    const res = await fetch(`${apiUrl}/api/v1/blog/posts`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return []
    const posts: Post[] = await res.json()
    return posts.filter((p) => p.slug !== currentSlug).slice(0, 3)
  } catch {
    return []
  }
}

// JSON-LD is injected via dangerouslySetInnerHTML. JSON.stringify does not escape
// "<", so a field containing "</script>" could break out of the inline script.
// Posts are admin-authored today, but escaping at the boundary is cheap defense
// in depth and matches the wedding-page layout.
function safeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) return { title: 'Not Found | AltarWed' }

  // seoTitle values may already carry a "| AltarWed" brand suffix; strip it so we
  // don't double-brand (e.g. "... | AltarWed | AltarWed Blog") in the title and
  // share cards.
  const baseTitle = (post.seoTitle ?? post.title).replace(/\s*\|\s*AltarWed\s*$/i, '')
  const title = `${baseTitle} | AltarWed Blog`
  const description = post.seoDesc ?? post.excerpt
  const url = `https://www.altarwed.com/blog/${post.slug}`

  // Give each post its own share card instead of falling back to the sitewide
  // brand OG image. The cover may be relative (self-hosted /public) or absolute
  // (external/Blob); Next resolves the relative case against metadataBase
  // (https://www.altarwed.com) into the absolute og:image scrapers require.
  const ogImages = post.coverImage ? [post.coverImage] : undefined

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: 'AltarWed',
      type: 'article',
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      authors: [post.author],
      images: ogImages,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ogImages,
    },
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [post, related] = await Promise.all([getPost(slug), getRelatedPosts(slug)])
  if (!post) notFound()

  const articleUrl = `https://www.altarwed.com/blog/${post.slug}`

  // post.content is raw DB-sourced HTML rendered via dangerouslySetInnerHTML on
  // the apex domain. Sanitize it server-side against the prose-only allowlist so
  // a malicious or compromised row cannot inject persistent XSS. Sanitizing here
  // (not client-side) keeps the SSR/SEO output identical for valid blog HTML.
  const sanitizedContent = sanitizePostContent(post.content)

  // schema.org images must be absolute. Covers are usually absolute (Blob /
  // external), but self-hosted /public covers are stored relative, so prefix
  // the origin in that case. next/image still gets the relative path for
  // same-origin optimization; only the JSON-LD copy is absolutized.
  const coverImageAbsolute = post.coverImage
    ? post.coverImage.startsWith('http')
      ? post.coverImage
      : `https://www.altarwed.com${post.coverImage}`
    : undefined

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    image: coverImageAbsolute ? [coverImageAbsolute] : undefined,
    inLanguage: 'en-US',
    author: { '@type': 'Organization', name: post.author, url: 'https://www.altarwed.com' },
    publisher: {
      '@type': 'Organization',
      name: 'AltarWed',
      url: 'https://www.altarwed.com',
      logo: { '@type': 'ImageObject', url: 'https://www.altarwed.com/icon.png' },
    },
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    mainEntityOfPage: { '@type': 'WebPage', '@id': articleUrl },
    url: articleUrl,
  }

  // Breadcrumb structured data renders a Home > Blog > Post trail in the Google
  // result, which both looks more trustworthy and reinforces site structure.
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.altarwed.com' },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://www.altarwed.com/blog' },
      { '@type': 'ListItem', position: 3, name: post.title, item: articleUrl },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd([articleJsonLd, breadcrumbJsonLd]) }}
      />
      <SiteHeader />
      <main>
        {/* Cover image */}
        {post.coverImage && (
          <div className="relative w-full h-64 sm:h-80 overflow-hidden">
            <Image src={post.coverImage} alt={post.title} fill className="object-cover" priority />
            <div className="absolute inset-0 bg-gradient-to-t from-[#3b2f2f]/40 to-transparent" />
          </div>
        )}

        {/* Header */}
        <section className="max-w-3xl mx-auto px-6 pt-10 pb-8">
          <div className="mb-6">
            <Link href="/blog" className="text-sm text-[#8a6a4a] hover:text-[#3b2f2f] transition">
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
          <div className="flex items-center gap-3 text-sm text-[#8a6a4a] border-t border-[#e8dcc8] pt-5">
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
            dangerouslySetInnerHTML={{ __html: sanitizedContent }}
          />
        </article>

        {/* Related articles, internal linking for topical clustering */}
        {related.length > 0 && (
          <section className="max-w-5xl mx-auto px-6 pb-16" aria-labelledby="related-heading">
            <h2 id="related-heading" className="font-serif text-2xl font-bold text-[#3b2f2f] mb-6">
              Keep reading
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/blog/${r.slug}`}
                  className="group block bg-white rounded-2xl border border-[#e8dcc8] shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all overflow-hidden"
                >
                  <div className="relative h-40 bg-[#f5ede0]">
                    {r.coverImage && (
                      <Image
                        src={r.coverImage}
                        alt={r.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover"
                      />
                    )}
                    {r.tags && (
                      <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-white/90 text-xs font-semibold uppercase tracking-widest text-[#a07840] backdrop-blur-sm">
                        {r.tags.split(',')[0].trim()}
                      </span>
                    )}
                  </div>
                  <div className="p-5">
                    <h3 className="font-serif text-lg font-semibold text-[#3b2f2f] mb-1 group-hover:text-[#d4af6a] transition-colors">
                      {r.title}
                    </h3>
                    <p className="text-[#6b5344] text-sm leading-relaxed line-clamp-2">{r.excerpt}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* CTA */}
        <section className="bg-[#f5ede0] py-14">
          <div className="max-w-2xl mx-auto px-6 text-center">
            <p className="text-[#d4af6a] text-xl mb-3">✦</p>
            <h2 className="font-serif text-2xl font-bold text-[#3b2f2f] mb-3">
              Ready to start planning your Christian wedding?
            </h2>
            <p className="text-[#6b5344] mb-7 text-sm">
              Create your free wedding website, manage your guest list, and build your ceremony on one faith-based platform.
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
