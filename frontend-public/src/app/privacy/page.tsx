import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'

export const metadata: Metadata = {
  title: 'Privacy Policy | AltarWed',
  description: 'How AltarWed collects, uses, and protects your personal information.',
}

const EFFECTIVE_DATE = 'May 11, 2026'
const CONTACT_EMAIL = 'hello@altarwed.com'

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-[#fdfaf6]">
        <div className="max-w-3xl mx-auto px-6 py-14">
          <h1 className="font-serif text-4xl font-bold text-[#3b2f2f] mb-2">Privacy Policy</h1>
          <p className="text-sm text-[#a08060] mb-10">Effective date: {EFFECTIVE_DATE}</p>

          <div className="prose prose-stone max-w-none text-[#3b2f2f] space-y-8">

            <Section title="1. Who We Are">
              <p>AltarWed (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) operates the website altarwed.com and the application at app.altarwed.com. We are a faith-first wedding planning platform connecting Christian couples with wedding vendors. Our mailing address and primary contact is <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#d4af6a] hover:underline">{CONTACT_EMAIL}</a>.</p>
            </Section>

            <Section title="2. Information We Collect">
              <p>We collect information you provide directly to us, including:</p>
              <ul>
                <li><strong>Account information:</strong> Name(s), email address, and password when you register as a couple or vendor.</li>
                <li><strong>Wedding information:</strong> Partner names, wedding date, venue details, guest list, RSVP responses, photos, and other content you add to your wedding website.</li>
                <li><strong>Guest information:</strong> Names, email addresses, meal preferences, and RSVP details for guests you invite through the platform.</li>
                <li><strong>Vendor information:</strong> Business name, category, location, photos, and contact details.</li>
                <li><strong>Communications:</strong> Email addresses and any messages submitted through contact forms or to our support email.</li>
              </ul>
              <p>We also collect certain information automatically when you use our services, including IP address, browser type, device identifiers, pages visited, and referring URLs, via standard server logs and cookies.</p>
            </Section>

            <Section title="3. How We Use Your Information">
              <p>We use the information we collect to:</p>
              <ul>
                <li>Create and manage your account and wedding website</li>
                <li>Send RSVP invitations and save-the-date emails to guests you designate</li>
                <li>Send transactional emails (password reset, account notifications)</li>
                <li>Display your public wedding website to visitors you share it with</li>
                <li>Improve our platform and develop new features</li>
                <li>Respond to your support requests</li>
                <li>Comply with legal obligations</li>
              </ul>
              <p>We do <strong>not</strong> sell your personal information to third parties. We do not use your information for behavioral advertising.</p>
            </Section>

            <Section title="4. Public Wedding Websites">
              <p>When you publish your wedding website, certain information becomes publicly accessible at altarwed.com/wedding/[your-slug], including partner names, wedding date, venue, wedding party details, photos you upload, and your prayer wall. You control which content is published. You may unpublish or delete your website at any time from your dashboard.</p>
              <p>You may optionally enable PIN protection to restrict access to your wedding website to guests who know the PIN.</p>
            </Section>

            <Section title="5. Sharing of Information">
              <p>We share your information only in the following circumstances:</p>
              <ul>
                <li><strong>Service providers:</strong> We use Resend (email delivery), Microsoft Azure (cloud infrastructure, database, file storage), and similar vendors to operate our platform. These providers process data on our behalf under data processing agreements.</li>
                <li><strong>Legal requirements:</strong> We may disclose information if required by law, court order, or to protect the safety and rights of our users.</li>
                <li><strong>Business transfers:</strong> If AltarWed is acquired or merged, your information may be transferred as part of that transaction. We will notify you via email before this occurs.</li>
              </ul>
            </Section>

            <Section title="6. Data Retention">
              <p>We retain your account and wedding data for as long as your account is active. If you delete your account, we will delete or anonymize your personal information within 30 days, except where we are required to retain it for legal or compliance reasons. Wedding website data is soft-deleted and may be retained for up to 90 days before permanent deletion.</p>
            </Section>

            <Section title="7. Your Rights">
              <p>Depending on your location, you may have the following rights:</p>
              <ul>
                <li><strong>Access:</strong> Request a copy of the personal data we hold about you.</li>
                <li><strong>Correction:</strong> Update or correct inaccurate information through your account settings or by contacting us.</li>
                <li><strong>Deletion:</strong> Request deletion of your account and associated data.</li>
                <li><strong>Portability:</strong> Request an export of your data in a machine-readable format.</li>
                <li><strong>Opt-out:</strong> Unsubscribe from marketing emails at any time via the unsubscribe link in the email.</li>
              </ul>
              <p>To exercise any of these rights, email <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#d4af6a] hover:underline">{CONTACT_EMAIL}</a>. We will respond within 30 days.</p>
            </Section>

            <Section title="8. Cookies">
              <p>We use a single authentication cookie (httpOnly, Secure, SameSite=Strict) to keep you logged in. We do not use advertising or tracking cookies. You can disable cookies in your browser settings; however, this will prevent you from staying logged in.</p>
            </Section>

            <Section title="9. Children's Privacy">
              <p>AltarWed is not directed at children under 13. We do not knowingly collect personal information from children under 13. If we learn that we have inadvertently collected such information, we will delete it promptly.</p>
            </Section>

            <Section title="10. Affiliate Disclosure">
              <p>Our /resources page contains affiliate links to Amazon and other retailers. When you purchase through these links, AltarWed may earn a small commission at no additional cost to you. We only recommend products we genuinely believe will help couples build strong, faith-first marriages.</p>
            </Section>

            <Section title="11. Security">
              <p>We use industry-standard security measures including encrypted passwords (bcrypt), HTTPS throughout, JWT tokens with short expiry, and Azure cloud security controls. No method of transmission over the internet is 100% secure. We will notify you promptly if a data breach occurs that affects your information.</p>
            </Section>

            <Section title="12. Changes to This Policy">
              <p>We may update this Privacy Policy from time to time. We will notify you of material changes by posting the new policy on this page with an updated effective date and, for significant changes, by sending an email to your registered address.</p>
            </Section>

            <Section title="13. Contact Us">
              <p>If you have questions about this Privacy Policy or our data practices, contact us at <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#d4af6a] hover:underline">{CONTACT_EMAIL}</a>.</p>
            </Section>
          </div>

          <div className="mt-10 pt-6 border-t border-[#e8dcc8] flex gap-6 text-sm">
            <Link href="/terms" className="text-[#d4af6a] hover:underline">Terms of Service →</Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-serif text-xl font-bold text-[#3b2f2f] mb-3">{title}</h2>
      <div className="text-sm text-[#6b5344] leading-relaxed space-y-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_strong]:text-[#3b2f2f] [&_a]:text-[#d4af6a]">
        {children}
      </div>
    </div>
  )
}
