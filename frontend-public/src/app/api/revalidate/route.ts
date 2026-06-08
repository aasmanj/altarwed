import { revalidatePath } from 'next/cache'
import { timingSafeEqual, createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

// Called by the Spring Boot backend after a successful wedding website update.
// Purges the cached SSR page so the next visitor gets fresh data immediately.
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-revalidate-secret')
  const slug = req.nextUrl.searchParams.get('slug')

  const expected = process.env.REVALIDATION_SECRET
  // Hash both to 32-byte SHA-256 digests before comparing so timingSafeEqual
  // never throws (buffer lengths always equal) and there is no length oracle.
  const isValid =
    secret != null &&
    expected != null &&
    timingSafeEqual(
      createHash('sha256').update(secret).digest(),
      createHash('sha256').update(expected).digest(),
    )

  if (!isValid) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
  }

  if (!slug || typeof slug !== 'string') {
    return NextResponse.json({ error: 'slug is required' }, { status: 400 })
  }

  revalidatePath(`/wedding/${slug}`)
  console.log(`[revalidate] Purged /wedding/${slug}`)

  return NextResponse.json({ revalidated: true, slug })
}
