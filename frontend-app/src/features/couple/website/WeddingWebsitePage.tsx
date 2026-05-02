import { useAuth } from '@/core/auth/AuthContext'
import { useWeddingWebsite } from './useWeddingWebsite'
import WeddingWebsiteSetup from './WeddingWebsiteSetup'
import WeddingWebsiteEditor from './WeddingWebsiteEditor'

export default function WeddingWebsitePage() {
  const { user } = useAuth()
  const coupleId = user?.id ?? ''

  const { data: website, isLoading, error } = useWeddingWebsite(coupleId)

  const isNotFound = (error as { response?: { status?: number } } | null)?.response?.status === 404

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-brown-light text-sm animate-pulse">Loading…</p>
      </div>
    )
  }

  // No website yet — show the creation wizard
  if (isNotFound || !website) {
    return (
      <WeddingWebsiteSetup
        coupleId={coupleId}
        defaultPartnerOne={user?.name?.split(' ')[0] ?? ''}
        defaultPartnerTwo=""
        defaultWeddingDate=""
      />
    )
  }

  return <WeddingWebsiteEditor website={website} coupleId={coupleId} />
}
