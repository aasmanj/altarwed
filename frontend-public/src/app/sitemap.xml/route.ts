import { loadSitemapUrls } from '@/lib/sitemapData'
import { renderSitemapIndex, sitemapPageCount } from '@/lib/sitemap'

// Sitemap index served at /sitemap.xml. It lists the paginated child sitemaps
// (/sitemap/0.xml, /sitemap/1.xml, ...) rather than emitting every URL inline,
// so the site never trips Google's 50,000-URL / 50MB per-file cap at our growth
// target. Next.js's generateSitemaps convention paginates children but does not
// emit a <sitemapindex> document, so we render the index ourselves here while
// keeping the same /sitemap/<id>.xml child URL scheme.
export const revalidate = 3600

export async function GET(): Promise<Response> {
  const urls = await loadSitemapUrls()
  const count = sitemapPageCount(urls.length)
  const xml = renderSitemapIndex(count)

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
