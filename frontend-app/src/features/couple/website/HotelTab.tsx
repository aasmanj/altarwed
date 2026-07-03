import { useState } from 'react'
import { MapPin, DollarSign, Loader2 } from 'lucide-react'
import { useConfirm } from '@/components/ConfirmDialog'
import type { WeddingHotelPayload, WeddingHotel } from './useHotels'

// Extracted out of the retired classic editor (issue #181) so the page builder's
// Travel drawer (WebsiteSectionDrawer.tsx) doesn't import a deleted file. Fully
// prop-driven, no shared state/context with any editor shell.

const hotelInputCls = 'w-full rounded-lg border border-gold-light px-3 py-2 text-brown text-sm focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold'

// Whether to render the "no hotels added yet" empty state. Kept as a pure,
// exported predicate so it can be unit-tested without a DOM (#187): the message
// must NOT show while the hotels query is still loading (the array defaults to
// [] before it resolves, so an empty array alone is ambiguous), only once
// loading has settled on a genuinely empty result and we're not mid-add.
export function shouldShowNoHotelsEmptyState(
  hotelCount: number,
  isLoading: boolean,
  isAddingNew: boolean,
): boolean {
  return !isLoading && hotelCount === 0 && !isAddingNew
}

export function HotelTab({ hotels, isLoading, onAdd, onUpdate, onDelete, isAddPending, isUpdatePending, isDeletePending }: {
  hotels: WeddingHotel[]
  isLoading: boolean
  onAdd: (p: WeddingHotelPayload) => void
  onUpdate: (id: string, p: WeddingHotelPayload) => void
  onDelete: (id: string) => void
  isAddPending: boolean
  isUpdatePending: boolean
  isDeletePending: boolean
}) {
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const confirm = useConfirm()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-brown">Hotel blocks for your guests</p>
        <button
          type="button"
          onClick={() => setEditingId('new')}
          className="rounded-lg bg-gold px-4 py-1.5 text-xs font-semibold text-white hover:bg-gold-dark transition"
        >
          + Add hotel
        </button>
      </div>

      {editingId === 'new' && (
        <HotelForm
          onSave={(p) => { onAdd(p); setEditingId(null) }}
          onCancel={() => setEditingId(null)}
          isPending={isAddPending}
        />
      )}

      {isLoading && hotels.length === 0 && editingId !== 'new' && (
        <p className="flex items-center justify-center gap-2 text-sm text-brown-light py-8 border border-dashed border-gold-light rounded-xl">
          <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Loading hotels…
        </p>
      )}

      {shouldShowNoHotelsEmptyState(hotels.length, isLoading, editingId === 'new') && (
        <p className="text-sm text-brown-light text-center py-8 border border-dashed border-gold-light rounded-xl">
          No hotels added yet. Add your first hotel block so guests know where to stay.
        </p>
      )}

      {hotels.map(hotel => editingId === hotel.id ? (
        <HotelForm
          key={hotel.id}
          initial={hotel}
          onSave={(p) => { onUpdate(hotel.id, p); setEditingId(null) }}
          onCancel={() => setEditingId(null)}
          isPending={isUpdatePending}
        />
      ) : (
        <div key={hotel.id} className="rounded-xl border border-gold-light bg-white p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-brown">{hotel.name}</p>
              {hotel.address && <p className="text-xs text-brown-light mt-0.5">{hotel.address}</p>}
              <div className="flex flex-wrap gap-3 mt-2">
                {hotel.distanceFromVenue && (
                  <span className="inline-flex items-center gap-1 text-xs text-brown-light"><MapPin size={12} className="text-gold" aria-hidden="true" /> {hotel.distanceFromVenue}</span>
                )}
                {hotel.blockRate && (
                  <span className="inline-flex items-center gap-1 text-xs text-brown-light"><DollarSign size={12} className="text-gold" aria-hidden="true" /> {hotel.blockRate}</span>
                )}
                {hotel.bookingUrl && (
                  <a href={hotel.bookingUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-gold hover:underline">Book →</a>
                )}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button type="button" onClick={() => setEditingId(hotel.id)}
                className="text-xs text-brown-light hover:text-brown">Edit</button>
              <button
                type="button"
                onClick={async () => { if (await confirm({ title: `Remove "${hotel.name}"?`, message: 'This hotel block will be removed from your wedding website.', tone: 'danger', confirmLabel: 'Remove' })) onDelete(hotel.id) }}
                disabled={isDeletePending}
                className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50"
              >Remove</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function HotelForm({ initial, onSave, onCancel, isPending }: {
  initial?: WeddingHotel
  onSave: (p: WeddingHotelPayload) => void
  onCancel: () => void
  isPending: boolean
}) {
  const [name, setName]     = useState(initial?.name ?? '')
  const [address, setAddr]  = useState(initial?.address ?? '')
  const [url, setUrl]       = useState(initial?.bookingUrl ?? '')
  const [rate, setRate]     = useState(initial?.blockRate ?? '')
  const [dist, setDist]     = useState(initial?.distanceFromVenue ?? '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      name: name.trim(),
      address: address.trim() || undefined,
      bookingUrl: url.trim() || undefined,
      blockRate: rate.trim() || undefined,
      distanceFromVenue: dist.trim() || undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-gold bg-white p-5 space-y-3">
      <p className="text-sm font-medium text-brown">{initial ? 'Edit hotel' : 'New hotel'}</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-brown-light mb-1">Hotel name *</label>
          <input required value={name} onChange={e => setName(e.target.value)} className={hotelInputCls} />
        </div>
        <div>
          <label className="block text-xs text-brown-light mb-1">Address</label>
          <input value={address} onChange={e => setAddr(e.target.value)} className={hotelInputCls} />
        </div>
        <div>
          <label className="block text-xs text-brown-light mb-1">Booking link</label>
          <input type="url" value={url} onChange={e => setUrl(e.target.value)} className={hotelInputCls} placeholder="https://..." />
        </div>
        <div>
          <label className="block text-xs text-brown-light mb-1">Block rate / notes</label>
          <input value={rate} onChange={e => setRate(e.target.value)} className={hotelInputCls} />
        </div>
        <div>
          <label className="block text-xs text-brown-light mb-1">Distance from venue</label>
          <input value={dist} onChange={e => setDist(e.target.value)} className={hotelInputCls} />
        </div>
      </div>
      <div className="flex gap-3 pt-1">
        <button type="submit" disabled={isPending}
          className="rounded-lg bg-gold px-5 py-2 text-sm font-semibold text-white hover:bg-gold-dark disabled:opacity-60 transition">
          {isPending ? 'Saving…' : 'Save hotel'}
        </button>
        <button type="button" onClick={onCancel}
          className="rounded-lg border border-gold-light px-5 py-2 text-sm font-medium text-brown hover:bg-ivory transition">
          Cancel
        </button>
      </div>
    </form>
  )
}
