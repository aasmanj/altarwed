import type { Metadata } from 'next'
import { Suspense } from 'react'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'
import UnsubscribeClient from './UnsubscribeClient'

export const metadata: Metadata = {
  title: 'Unsubscribe | AltarWed',
  description: 'Manage your AltarWed email preferences.',
  alternates: { canonical: 'https://www.altarwed.com/unsubscribe' },
  robots: { index: false },
}

export default function UnsubscribePage() {
  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-[#fdfaf6] flex items-center justify-center px-4">
        <div className="max-w-md w-full py-14">
          <h1 className="font-serif text-3xl font-bold text-[#3b2f2f] mb-4">Unsubscribe</h1>
          <Suspense fallback={<p className="text-sm text-[#6b5344]">Loading&hellip;</p>}>
            <UnsubscribeClient />
          </Suspense>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
