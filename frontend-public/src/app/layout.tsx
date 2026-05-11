import type { Metadata } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import './globals.css'
import FacebookPixel from '@/components/FacebookPixel'

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
    default: 'AltarWed — Christian Wedding Planning Platform',
    template: '%s | AltarWed',
  },
  description:
    'AltarWed is the faith-first wedding planning marketplace connecting Christian couples with vendors who share their values. Plan your covenant celebration with scripture, denomination, and faith at the center.',
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
    title: 'AltarWed — Christian Wedding Planning Platform',
    description:
      'The faith-first marketplace connecting Christian couples with vendors who share their values. Plan your covenant celebration the way God intended.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'AltarWed — Christian Wedding Planning',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AltarWed — Christian Wedding Planning Platform',
    description:
      'The faith-first marketplace for Christian couples and vendors.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  alternates: {
    canonical: siteUrl,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body>
        <FacebookPixel />
        {children}
      </body>
    </html>
  )
}
