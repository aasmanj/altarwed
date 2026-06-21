import type { Metadata } from 'next'
import Link from 'next/link'
import { LifeBuoy, Mail } from 'lucide-react'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'

export const metadata: Metadata = {
  title: 'Help & How to Use AltarWed | AltarWed',
  description:
    'Answers to common questions about building your wedding website, guest list and RSVPs, save-the-dates, photos, and your account on AltarWed.',
  alternates: { canonical: 'https://www.altarwed.com/help' },
  openGraph: {
    title: 'Help & How to Use AltarWed | AltarWed',
    description: 'How to build your wedding website, manage RSVPs, send save-the-dates, add photos, and more.',
    url: 'https://www.altarwed.com/help',
    siteName: 'AltarWed',
    type: 'website',
  },
}

// ISR: help content is near-static, so revalidate slowly.
export const revalidate = 3600

const SUPPORT_EMAIL = 'hello@altarwed.com'

interface Faq {
  q: string
  a: string
}
interface Section {
  heading: string
  items: Faq[]
}

// Single source of truth: the visible accordions and the FAQPage JSON-LD are both
// generated from this, so they can never drift. Answers are plain text (the schema
// requires it, and it keeps the copy easy for Jordan to edit).
const SECTIONS: Section[] = [
  {
    heading: 'Building your website',
    items: [
      {
        q: 'How do I create my wedding website?',
        a: 'Sign up for a free account, and the setup wizard walks you through your names, your website link, your date, venue, a hotel block, a hero photo, a scripture, and your registry. Every step after your names and link is optional, so you can skip anything and add it later in the editor.',
      },
      {
        q: 'My guests cannot see my website. Why?',
        a: 'Your site starts as a private draft that only you can see. Open the website editor and publish it when you are ready, then anyone with the link can view it and RSVP.',
      },
      {
        q: 'What is my website link, and is it unique?',
        a: 'Your site lives at altarwed.com/wedding/your-names. You choose this link during setup and it has to be unique, so if your first choice is taken, try adding your wedding date or city.',
      },
    ],
  },
  {
    heading: 'Guests and RSVPs',
    items: [
      {
        q: 'How do I add guests?',
        a: 'On the Guest List page you can add guests one at a time, or connect a Google Sheet and AltarWed will keep your list in sync automatically (it checks for changes every 15 minutes).',
      },
      {
        q: 'How do my guests RSVP?',
        a: 'Each guest gets a personal RSVP link in their invite email. Guests can also visit your public website and find their invitation by name on the RSVP page.',
      },
      {
        q: 'How long is an RSVP invite link valid?',
        a: 'An invite link works for 30 days. If it expires, you can send the guest a fresh invite.',
      },
      {
        q: 'How many times can I email the same guest an invite?',
        a: 'Up to three invites per guest. After that the guest shows a "Max sent" badge, so you do not accidentally over-email anyone.',
      },
      {
        q: 'A guest unsubscribed. Can they still RSVP, and can they come back?',
        a: 'Yes. Unsubscribing stops that wedding\'s emails for the guest. The moment they RSVP, they are automatically re-subscribed, so your later updates reach them again.',
      },
    ],
  },
  {
    heading: 'Save-the-dates and email',
    items: [
      {
        q: 'My save-the-date landed in the Promotions tab in Gmail. Is something broken?',
        a: 'No, the email was delivered successfully. Gmail simply sorted it into the Promotions tab. Ask your guests to drag it into their Primary tab and reply once; Gmail then learns to deliver your future emails to Primary. We also send from a dedicated wedding-invite address to help with this.',
      },
      {
        q: 'When a guest replies to one of our emails, where does the reply go?',
        a: 'Straight to your own inbox, the email address on your AltarWed account. Replies are not sent to a shared AltarWed mailbox.',
      },
      {
        q: 'What photo file types and sizes can I upload?',
        a: 'JPEG, PNG, WebP, or HEIC (the format iPhones use), up to 15 MB per photo.',
      },
    ],
  },
  {
    heading: 'Photos and wedding party',
    items: [
      {
        q: 'How do I crop or recenter a photo?',
        a: 'On the Photos page click the crop icon on a photo, or on the Wedding Party page click Reposition under a member. Then drag the image to recenter it and use the zoom slider to crop in. Your original photo is never changed, so you can re-adjust any time.',
      },
      {
        q: 'How do I reorder my photos or wedding party?',
        a: 'Drag them into the order you want using the grip handle on each item. The new order saves automatically and is what your guests see.',
      },
      {
        q: 'What kind of photo works best for the hero banner?',
        a: 'A wide, landscape photo works best at the top of your site. Tall portrait photos get cropped at the top and bottom in the banner, but you can reposition them to choose what shows.',
      },
    ],
  },
  {
    heading: 'Your account',
    items: [
      {
        q: 'How do I reset my password?',
        a: 'Use the "Forgot password" link on the login page. The reset link we email you expires after 15 minutes for security, so use it promptly.',
      },
      {
        q: 'How do I delete my account?',
        a: 'In your account settings, choose Delete account. This permanently removes your wedding website, guest list, and planning data, and it cannot be undone.',
      },
    ],
  },
]

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: SECTIONS.flatMap(s =>
    s.items.map(item => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  ),
}

export default function HelpPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <SiteHeader />
      <main className="max-w-3xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <LifeBuoy className="w-10 h-10 text-[#d4af6a] mx-auto mb-4" strokeWidth={1.5} />
          <h1 className="font-serif text-4xl font-bold text-[#3b2f2f] mb-3">Help &amp; how to use AltarWed</h1>
          <p className="text-[#6b5344] text-lg leading-relaxed">
            Quick answers to the questions couples ask most. Cannot find what you need? Email us and a real person will help.
          </p>
        </div>

        <div className="space-y-12">
          {SECTIONS.map(section => (
            <section key={section.heading}>
              <h2 className="font-serif text-2xl font-bold text-[#3b2f2f] mb-4">{section.heading}</h2>
              <div className="space-y-3">
                {section.items.map(item => (
                  <details
                    key={item.q}
                    className="group rounded-lg border border-[#e8dcc8] bg-[#fdfaf6] px-5 py-4 [&_summary]:cursor-pointer"
                  >
                    <summary className="flex items-center justify-between gap-4 font-medium text-[#3b2f2f] list-none">
                      <span>{item.q}</span>
                      <span className="text-[#d4af6a] text-xl leading-none transition-transform group-open:rotate-45" aria-hidden="true">
                        +
                      </span>
                    </summary>
                    <p className="mt-3 text-[#6b5344] leading-relaxed">{item.a}</p>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Escalation: self-serve failed, route a real bug to Jordan's inbox. */}
        <div className="mt-16 rounded-2xl border border-[#e8dcc8] bg-white p-8 text-center">
          <Mail className="w-8 h-8 text-[#d4af6a] mx-auto mb-3" strokeWidth={1.5} />
          <h2 className="font-serif text-2xl font-bold text-[#3b2f2f] mb-2">Still stuck?</h2>
          <p className="text-[#6b5344] mb-5 leading-relaxed">
            If something is not working the way it should, email us with what you were doing and what happened. We read every message.
          </p>
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('AltarWed help request')}`}
            className="inline-flex items-center gap-2 rounded-lg bg-[#3b2f2f] px-6 py-3 text-sm font-semibold text-[#d4af6a] hover:bg-[#5c4033] transition"
          >
            <Mail className="w-4 h-4" /> Email {SUPPORT_EMAIL}
          </a>
          <p className="mt-6 text-sm text-[#8a6a4a]">
            Ready to start? <Link href="https://app.altarwed.com/register" className="text-[#d4af6a] hover:underline">Create your free wedding website</Link>.
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
