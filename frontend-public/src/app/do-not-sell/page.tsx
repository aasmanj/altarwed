import type { Metadata } from 'next'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'
import DoNotSellClient from './DoNotSellClient'

export const metadata: Metadata = {
  title: 'Do Not Sell or Share My Personal Information | AltarWed',
  description: 'Exercise your CCPA/CPRA right to opt out of the sale or sharing of your personal information for cross-context behavioral advertising.',
  alternates: { canonical: 'https://www.altarwed.com/do-not-sell' },
  robots: { index: false },
}

export default function DoNotSellPage() {
  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-[#fdfaf6]">
        <div className="max-w-2xl mx-auto px-6 py-14">
          <h1 className="font-serif text-3xl font-bold text-[#3b2f2f] mb-4">
            Do Not Sell or Share My Personal Information
          </h1>
          <p className="text-sm text-[#6b5344] leading-relaxed mb-8">
            Under the California Consumer Privacy Act (CCPA/CPRA), California residents have the right
            to opt out of the &ldquo;sale&rdquo; or &ldquo;sharing&rdquo; of their personal information
            for cross-context behavioral advertising. AltarWed uses the Meta (Facebook) Pixel, which
            constitutes &ldquo;sharing&rdquo; under CPRA when active.
          </p>
          <DoNotSellClient />
          <p className="text-sm text-[#8a6a4a] mt-8 leading-relaxed">
            We also honor the Global Privacy Control (GPC) browser signal automatically.
            You may also email <a href="mailto:hello@altarwed.com" className="text-[#d4af6a] hover:underline">hello@altarwed.com</a> to opt out or ask questions about our data practices.
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
