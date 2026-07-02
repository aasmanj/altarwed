import { loadSitemapUrls } from '@/lib/sitemapData'
import {
  paginateSitemapUrls,
  parseSitemapId,
  renderUrlset,
} from '@/lib/sitemap'

// Child sitemap served at /sitemap/<id>.xml (e.g. /sitemap/0.xml). Each page
// holds at most SITEMAP_URL_LIMIT (50,000) URLs, the slice of the full URL list
// that belongs to this page id. Referenced by the sitemap index at /sitemap.xml.
export const revalidate = 3600

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params
  const pageIndex = parseSitemapId(id)
  if (pageIndex === null) {
    return new Response('Not Found', { status: 404 })
  }

  const urls = await loadSitemapUrls()
  const pages = paginateSitemapUrls(urls)
  const page = pages[pageIndex]
  if (!page) {
    return new Response('Not Found', { status: 404 })
  }

  return new Response(renderUrlset(page), {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
