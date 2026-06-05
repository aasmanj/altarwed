import type { Metadata } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import './globals.css'
import FacebookPixel from '@/components/FacebookPixel'
import CookieConsentBanner from '@/components/CookieConsentBanner'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
})

const siteUrl = 'https://www.altarwed.com'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'AltarWed: Christian Wedding Planning Platform',
    template: '%s | AltarWed',
  },
  description:
    'Plan your Christian wedding on AltarWed. Build a shareable wedding website, manage your guest list, and find faith-based vendors who share your values.',
  keywords: [
    'christian wedding planning',
    'faith based wedding vendors',
    'christian wedding marketplace',
    'covenant wedding',
    'christian wedding platform',
  ],
  authors: [{ name: 'AltarWed' }],
  creator: 'AltarWed',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    siteName: 'AltarWed',
    title: 'AltarWed: Christian Wedding Planning Platform',
    description:
      'A faith-based wedding planning platform for Christian couples. Build your wedding website, manage guests, and find vendors who share your faith.',
    // og:image is supplied by the file-based opengraph-image.tsx convention.
    // Do not also declare images here, it would emit a duplicate og:image
    // pointing at the non-existent /og-image.png.
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AltarWed: Christian Wedding Planning Platform',
    description:
      'A faith-based platform for Christian couples and vendors.',
    // No twitter:image, Twitter/X falls back to og:image (the generated card)
    // when twitter:image is absent, so this stays DRY.
  },
  icons: {
    icon: '/icon.png',
    apple: '/apple-icon.png',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  // NOTE: Do NOT set alternates.canonical here. Next.js merges layout metadata
  // into every child page, so a canonical set on the root layout would cascade
  // to all routes that don't override it, making Google think every page is
  // a duplicate of the homepage. Each page sets its own canonical instead.
}

const orgJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'AltarWed',
  url: siteUrl,
  logo: `${siteUrl}/icon.png`,
  sameAs: [],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
        <FacebookPixel />
        <CookieConsentBanner />
        {children}
      </body>
    </html>
  )
}
