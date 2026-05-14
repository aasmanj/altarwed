import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'

export const metadata: Metadata = {
  title: 'Terms of Service | AltarWed',
  description: 'The terms and conditions governing your use of AltarWed.',
}

const EFFECTIVE_DATE = 'May 11, 2026'
const CONTACT_EMAIL = 'hello@altarwed.com'

export default function TermsPage() {
  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-[#fdfaf6]">
        <div className="max-w-3xl mx-auto px-6 py-14">
          <h1 className="font-serif text-4xl font-bold text-[#3b2f2f] mb-2">Terms of Service</h1>
          <p className="text-sm text-[#a08060] mb-10">Effective date: {EFFECTIVE_DATE}</p>

          <div className="space-y-8">

            <Section title="1. Acceptance of Terms">
              <p>By accessing or using AltarWed (&ldquo;the Service&rdquo;) at altarwed.com or app.altarwed.com, you agree to be bound by these Terms of Service. If you do not agree, do not use the Service. These Terms constitute a legally binding agreement between you and AltarWed (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;).</p>
            </Section>

            <Section title="2. Description of Service">
              <p>AltarWed is a faith-based wedding planning platform that allows engaged couples to create public wedding websites, manage guest lists, plan their ceremony, and discover Christian wedding vendors. Vendors may list their businesses on the platform to connect with couples.</p>
            </Section>

            <Section title="3. Account Registration">
              <p>You must register for an account to access most features. You agree to:</p>
              <ul>
                <li>Provide accurate and complete registration information</li>
                <li>Keep your password confidential and not share it with others</li>
                <li>Notify us immediately at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> if you suspect unauthorized access to your account</li>
                <li>Be responsible for all activity that occurs under your account</li>
              </ul>
              <p>You must be at least 18 years old to register for an account.</p>
            </Section>

            <Section title="4. User Content">
              <p>You retain ownership of content you submit to the Service (&ldquo;User Content&rdquo;), including wedding website text, photos, and guest information. By submitting User Content, you grant AltarWed a non-exclusive, royalty-free, worldwide license to host, display, and distribute your User Content solely as necessary to operate the Service.</p>
              <p>You are solely responsible for your User Content. You agree not to submit content that:</p>
              <ul>
                <li>Is unlawful, defamatory, harassing, or fraudulent</li>
                <li>Infringes any third party&apos;s intellectual property rights</li>
                <li>Contains malware, spam, or unauthorized advertising</li>
                <li>Violates the privacy of others</li>
              </ul>
              <p>We reserve the right to remove User Content that violates these Terms without notice.</p>
            </Section>

            <Section title="5. Public Wedding Websites">
              <p>When you publish your wedding website, it becomes accessible to anyone with the URL. You are responsible for the content you publish. You may unpublish or delete your website at any time. AltarWed displays a &ldquo;Created with AltarWed&rdquo; attribution on public wedding pages.</p>
            </Section>

            <Section title="6. Prohibited Uses">
              <p>You may not use the Service to:</p>
              <ul>
                <li>Scrape, crawl, or harvest data from the platform without written permission</li>
                <li>Attempt to gain unauthorized access to other users&apos; accounts or data</li>
                <li>Transmit spam or unsolicited commercial messages</li>
                <li>Impersonate another person or entity</li>
                <li>Use the platform for any unlawful purpose</li>
                <li>Interfere with or disrupt the integrity or performance of the Service</li>
              </ul>
            </Section>

            <Section title="7. Vendor Listings and Religious Mission">
              <p>AltarWed is a faith-based platform dedicated to supporting Christian couples in planning their weddings and building their marriages on a foundation of faith.</p>
              <p>Vendors who list services on AltarWed acknowledge that the platform exists to serve couples planning Christian weddings consistent with a biblical understanding of marriage as a covenant between one man and one woman.</p>
              <p>By submitting a vendor listing, you represent that:</p>
              <ul>
                <li>The information provided is accurate and current</li>
                <li>You have the right to use all images and content submitted</li>
                <li>Your business operates lawfully</li>
              </ul>
              <p>Vendors agree that all listings, profiles, descriptions, images, and services promoted through AltarWed will be consistent with the platform&apos;s religious mission and the couples it serves.</p>
              <p>AltarWed reserves the right, in its sole discretion, to decline to publish, suspend, or remove any vendor listing or account that AltarWed determines to be inconsistent with its religious mission or the values of the Christian couples it serves.</p>
              <p>Participation in the AltarWed vendor community is entirely voluntary. AltarWed retains sole authority to interpret and apply these standards in good faith. This policy reflects AltarWed&apos;s identity as a faith-based platform, not a judgment of any individual or business.</p>
              <p>Paid vendor subscription plans govern additional terms for featured listings. All fees paid before a listing is removed for mission-inconsistency are non-refundable.</p>
            </Section>

            <Section title="8. Payment and Subscriptions">
              <p>Certain features of AltarWed require a paid subscription. Payment terms, pricing, and cancellation policies will be presented at the time of purchase. All fees are non-refundable except as required by law or as stated in our refund policy. We reserve the right to change pricing with 30 days&apos; notice to existing subscribers.</p>
            </Section>

            <Section title="9. Intellectual Property">
              <p>The AltarWed name, logo, and all platform code, design, and original content are owned by AltarWed and protected by applicable intellectual property laws. You may not copy, modify, distribute, or create derivative works without our written permission.</p>
            </Section>

            <Section title="10. Disclaimer of Warranties">
              <p>THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS.</p>
            </Section>

            <Section title="11. Limitation of Liability">
              <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, ALTARWED SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, DATA, OR GOODWILL, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF THE SERVICE, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. OUR TOTAL LIABILITY TO YOU FOR ANY CLAIM ARISING FROM THESE TERMS OR THE SERVICE SHALL NOT EXCEED $100.</p>
            </Section>

            <Section title="12. Indemnification">
              <p>You agree to indemnify and hold harmless AltarWed and its officers, directors, and employees from any claims, damages, losses, and expenses (including reasonable attorneys&apos; fees) arising from your use of the Service, your User Content, or your violation of these Terms.</p>
            </Section>

            <Section title="13. Termination">
              <p>You may delete your account at any time from your account settings. We reserve the right to suspend or terminate your account at any time for violation of these Terms. Upon termination, your right to use the Service ceases immediately.</p>
            </Section>

            <Section title="14. Governing Law">
              <p>These Terms are governed by the laws of the United States. Any disputes arising under these Terms shall be subject to the exclusive jurisdiction of courts located in the United States.</p>
            </Section>

            <Section title="15. Changes to Terms">
              <p>We may update these Terms from time to time. We will notify you of material changes by email and by posting a notice on our website. Continued use of the Service after changes become effective constitutes your acceptance of the updated Terms.</p>
            </Section>

            <Section title="16. Contact">
              <p>Questions about these Terms? Contact us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
            </Section>
          </div>

          <div className="mt-10 pt-6 border-t border-[#e8dcc8] flex gap-6 text-sm">
            <Link href="/privacy" className="text-[#d4af6a] hover:underline">Privacy Policy →</Link>
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
      <div className="text-sm text-[#6b5344] leading-relaxed space-y-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_a]:text-[#d4af6a] [&_a]:hover:underline">
        {children}
      </div>
    </div>
  )
}
