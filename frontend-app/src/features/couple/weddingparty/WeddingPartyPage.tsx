import { Link } from 'react-router-dom'
import { useAuth } from '@/core/auth/AuthContext'
import PageHeader from '@/components/PageHeader'
import { useWeddingWebsite } from '@/features/couple/website/useWeddingWebsite'
import { useWeddingParty } from './useWeddingParty'
import WeddingPartyManager from './WeddingPartyManager'

export default function WeddingPartyPage() {
  const { user } = useAuth()
  const coupleId = user?.id ?? ''

  const { data: website } = useWeddingWebsite(coupleId)
  const websiteId = website?.id ?? ''

  // Counts for the header subtitle. Same query key as the manager, so React
  // Query dedupes this, it isn't a second network request.
  const { data: members = [] } = useWeddingParty(websiteId)
  const brideCount   = members.filter(m => m.side === 'BRIDE').length
  const groomCount   = members.filter(m => m.side === 'GROOM').length
  const neutralCount = members.filter(m => m.side === 'NEUTRAL').length

  return (
    <div className="min-h-screen bg-ivory">
      <PageHeader
        title="Wedding Party"
        subtitle={members.length > 0
          ? `${brideCount} bride's · ${groomCount} groom's${neutralCount > 0 ? ` · ${neutralCount} ceremony` : ''}`
          : 'Add your wedding party members'}
        maxWidth="max-w-3xl"
      />

      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-10">
        {!websiteId ? (
          <div className="rounded-xl border border-gold-light bg-white p-8 text-center mb-8">
            <p className="text-brown font-medium mb-1">Set up your wedding website first</p>
            <p className="text-sm text-brown-light mb-4">Wedding party is tied to your public wedding page.</p>
            <Link to="/dashboard/website" className="text-sm text-gold hover:underline">
              Set up wedding website →
            </Link>
          </div>
        ) : (
          <WeddingPartyManager websiteId={websiteId} />
        )}
      </main>
    </div>
  )
}
