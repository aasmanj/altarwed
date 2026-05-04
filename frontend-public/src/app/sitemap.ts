import { MetadataRoute } from 'next'

const BASE_URL = 'https://www.altarwed.com'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages — always included
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1.0,
    },
  ]

  // Dynamic wedding website pages — fetched from the API
  // Only published, non-deleted websites appear in the sitemap
  let weddingPages: MetadataRoute.Sitemap = []
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/wedding-websites/published`, {
      next: { revalidate: 3600 }, // rebuild sitemap entry at most once per hour
    })
    if (res.ok) {
      const websites: { slug: string; updatedAt: string }[] = await res.json()
      weddingPages = websites.map((site) => ({
        url: `${BASE_URL}/wedding/${site.slug}`,
        lastModified: new Date(site.updatedAt),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      }))
    }
  } catch {
    // If the API is down, still serve static pages — don't break the sitemap
  }

  return [...staticPages, ...weddingPages]
}
