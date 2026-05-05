import { revalidatePath } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'

// Called by the Spring Boot backend after a successful wedding website update.
// Purges the cached SSR page so the next visitor gets fresh data immediately.
export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  const slug = req.nextUrl.searchParams.get('slug')

  if (!secret || secret !== process.env.REVALIDATION_SECRET) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
  }

  if (!slug || typeof slug !== 'string') {
    return NextResponse.json({ error: 'slug is required' }, { status: 400 })
  }

  revalidatePath(`/wedding/${slug}`)
  console.log(`[revalidate] Purged /wedding/${slug}`)

  return NextResponse.json({ revalidated: true, slug })
}
