import { notFound } from 'next/navigation'
import { getWedding } from '../data'
import PrayerWallClient from './PrayerWallClient'

interface Prayer {
  id: string
  guestName: string
  prayerText: string
  createdAt: string
}

async function getPrayers(slug: string): Promise<Prayer[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'https://altarwed-prod-api.azurewebsites.net'
  try {
    const res = await fetch(`${apiUrl}/api/v1/prayers/website/${slug}`, { next: { revalidate: 30 } })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

export default async function PrayersPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const [wedding, prayers] = await Promise.all([getWedding(slug), getPrayers(slug)])
  if (!wedding || !wedding.isPublished) notFound()

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'https://altarwed-prod-api.azurewebsites.net'

  return (
    <PrayerWallClient
      slug={slug}
      coupleNames={`${wedding.partnerOneName} & ${wedding.partnerTwoName}`}
      initialPrayers={prayers}
      apiUrl={apiUrl}
    />
  )
}
