import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/core/auth/AuthContext'
import { useWeddingWebsite } from '@/features/couple/website/useWeddingWebsite'
import {
  useWeddingParty, useAddMember, useUpdateMember, useDeleteMember, useUploadMemberPhoto,
  type WeddingPartyMember, type PartySide,
} from './useWeddingParty'

const SUGGESTED_ROLES = [
  'Officiant / Pastor', 'Maid of Honor', 'Best Man',
  'Bridesmaid', 'Groomsman', 'Flower Girl', 'Ring Bearer',
  'Mother of the Bride', 'Father of the Bride',
  'Mother of the Groom', 'Father of the Groom',
]

const inputCls = 'w-full rounded-lg border border-gold-light px-3 py-2 text-brown text-sm focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold'

export default function WeddingPartyPage() {
  const { user } = useAuth()
  const coupleId = user?.id ?? ''

  const { data: website } = useWeddingWebsite(coupleId)
  const websiteId = website?.id ?? ''

  const { data: members = [], isLoading } = useWeddingParty(websiteId)
  const addMember    = useAddMember(websiteId)
  const updateMember = useUpdateMember(websiteId)
  const deleteMember = useDeleteMember(websiteId)
  const uploadPhoto  = useUploadMemberPhoto(websiteId)
  const uploadError  = uploadPhoto.error
    ? ((uploadPhoto.error as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? 'Upload failed. Please try again.')
    : null

  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [sideFilter, setSideFilter] = useState<PartySide | 'ALL'>('ALL')

  const brideParty   = members.filter(m => m.side === 'BRIDE')
  const groomParty   = members.filter(m => m.side === 'GROOM')
  const neutralParty = members.filter(m => m.side === 'NEUTRAL')
  const displayed    = sideFilter === 'ALL' ? members
    : members.filter(m => m.side === sideFilter)

  return (
    <div className="min-h-screen bg-ivory">
      <header className="border-b border-gold-light bg-white px-6 py-4 flex items-center justify-between">
        <Link to="/dashboard" className="font-serif text-xl font-bold text-brown">AltarWed</Link>
        <Link to="/dashboard" className="text-sm text-brown-light hover:text-brown transition">
          ← Dashboard
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
          <div>
            <h1 className="font-serif text-2xl font-bold text-brown">Wedding Party</h1>
            <p className="text-brown-light text-sm mt-1">
              {members.length > 0
                ? `${brideParty.length} bride's · ${groomParty.length} groom's${neutralParty.length > 0 ? ` · ${neutralParty.length} ceremony` : ''}`
                : 'Add your wedding party members'}
            </p>
          </div>
          <button
            onClick={() => setShowAdd(v => !v)}
            className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-white hover:bg-gold-dark transition"
          >
            + Add member
          </button>
        </div>

        {!websiteId && (
          <div className="rounded-xl border border-gold-light bg-white p-8 text-center mb-8">
            <p className="text-brown font-medium mb-1">Set up your wedding website first</p>
            <p className="text-sm text-brown-light mb-4">Wedding party is tied to your public wedding page.</p>
            <Link to="/dashboard/website" className="text-sm text-gold hover:underline">
              Set up wedding website →
            </Link>
          </div>
        )}

        {/* Add member form */}
        {showAdd && websiteId && (
          <MemberForm
            onSubmit={async (data) => {
              await addMember.mutateAsync(data)
              setShowAdd(false)
            }}
            onCancel={() => setShowAdd(false)}
            isPending={addMember.isPending}
          />
        )}

        {/* Side filter */}
        {members.length > 0 && (
          <div className="flex gap-1 mb-6 border-b border-gold-light">
            {(['ALL', 'BRIDE', 'GROOM', 'NEUTRAL'] as const).map(f => (
              <button
                key={f}
                onClick={() => setSideFilter(f)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
                  sideFilter === f ? 'border-gold text-brown' : 'border-transparent text-brown-light hover:text-brown'
                }`}
              >
                {f === 'ALL' ? 'All' : f === 'BRIDE' ? "Bride's side" : f === 'GROOM' ? "Groom's side" : 'Ceremony'}
              </button>
            ))}
          </div>
        )}

        {uploadError && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 mb-4 text-sm text-red-700">
            {uploadError}
          </div>
        )}

        {isLoading ? (
          <p className="text-center text-brown-light py-16 animate-pulse">Loading wedding party…</p>
        ) : displayed.length === 0 && !showAdd ? (
          <div className="text-center py-16">
            <p className="text-brown font-medium mb-1">No members yet</p>
            <p className="text-sm text-brown-light">Add your officiant, wedding party, and family.</p>
            <p className="text-xs text-brown-light mt-2">Tip: add your pastor or officiant first — it's front and center on your wedding website.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {displayed.map(member => (
              editingId === member.id ? (
                <MemberForm
                  key={member.id}
                  initial={member}
                  onSubmit={async (data) => {
                    await updateMember.mutateAsync({ memberId: member.id, payload: data })
                    setEditingId(null)
                  }}
                  onCancel={() => setEditingId(null)}
                  isPending={updateMember.isPending}
                />
              ) : (
                <MemberCard
                  key={member.id}
                  member={member}
                  onEdit={() => setEditingId(member.id)}
                  onDelete={() => {
                    if (confirm(`Remove ${member.name}?`)) deleteMember.mutate(member.id)
                  }}
                  onPhotoUpload={(file) => uploadPhoto.mutate({ memberId: member.id, file })}
                  isUploading={uploadPhoto.isPending}
                />
              )
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function MemberCard({ member, onEdit, onDelete, onPhotoUpload, isUploading }: {
  member: WeddingPartyMember
  onEdit: () => void
  onDelete: () => void
  onPhotoUpload: (file: File) => void
  isUploading: boolean
}) {
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  return (
    <div className="rounded-xl border border-gold-light bg-white p-5 flex gap-5 items-start">
      <div className="relative shrink-0 group">
        {member.photoUrl ? (
          <img
            src={member.photoUrl}
            alt={member.name}
            className="h-16 w-16 rounded-full object-cover border border-gold-light"
          />
        ) : (
          <div className="h-16 w-16 rounded-full bg-ivory border border-gold-light flex items-center justify-center">
            <span className="text-2xl text-brown-light font-serif">{member.name.charAt(0)}</span>
          </div>
        )}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center disabled:cursor-wait"
          title="Upload photo"
        >
          <span className="text-white text-xs font-medium">{isUploading ? '…' : '📷'}</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0]
            if (file) onPhotoUpload(file)
            e.target.value = ''
          }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-serif font-semibold text-brown">{member.name}</p>
            <p className="text-sm text-gold font-medium">{member.role}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block font-medium ${
              member.side === 'BRIDE' ? 'bg-pink-50 text-pink-700'
              : member.side === 'GROOM' ? 'bg-blue-50 text-blue-700'
              : 'bg-amber-50 text-amber-700'
            }`}>
              {member.side === 'BRIDE' ? "Bride's side" : member.side === 'GROOM' ? "Groom's side" : 'Ceremony'}
            </span>
          </div>
          <div className="flex gap-3 shrink-0">
            <button onClick={onEdit} className="text-xs text-brown-light hover:text-brown transition">Edit</button>
            <button onClick={onDelete} className="text-xs text-red-400 hover:text-red-600 transition">Remove</button>
          </div>
        </div>
        {member.bio && (
          <p className="text-sm text-brown-light mt-2 leading-relaxed line-clamp-2">{member.bio}</p>
        )}
      </div>
    </div>
  )
}

function MemberForm({ initial, onSubmit, onCancel, isPending }: {
  initial?: WeddingPartyMember
  onSubmit: (data: { name: string; role: string; side: PartySide; bio?: string }) => Promise<void>
  onCancel: () => void
  isPending: boolean
}) {
  const [name, setName]   = useState(initial?.name ?? '')
  const [role, setRole]   = useState(initial?.role ?? '')
  const [side, setSide]   = useState<PartySide>(initial?.side ?? 'BRIDE')
  const [bio, setBio]     = useState(initial?.bio ?? '')
  const [customRole, setCustomRole] = useState(!SUGGESTED_ROLES.includes(initial?.role ?? ''))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({ name: name.trim(), role: role.trim(), side, bio: bio.trim() || undefined })
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-gold bg-white p-5 mb-4 space-y-4">
      <p className="font-medium text-brown text-sm">{initial ? 'Edit member' : 'New member'}</p>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-brown-light mb-1">Name *</label>
          <input required value={name} onChange={e => setName(e.target.value)}
            className={inputCls} placeholder="Full name" />
        </div>
        <div>
          <label className="block text-xs font-medium text-brown-light mb-1">Side *</label>
          <select value={side} onChange={e => setSide(e.target.value as PartySide)} className={inputCls}>
            <option value="BRIDE">Bride's side</option>
            <option value="GROOM">Groom's side</option>
            <option value="NEUTRAL">Ceremony (officiant, readers, musicians)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-brown-light mb-1">Role *</label>
          {customRole ? (
            <div className="flex gap-2">
              <input required value={role} onChange={e => setRole(e.target.value)}
                className={inputCls} placeholder="Custom role" />
              <button type="button" onClick={() => { setCustomRole(false); setRole('') }}
                className="text-xs text-brown-light hover:text-brown shrink-0">← Pick</button>
            </div>
          ) : (
            <div className="flex gap-2">
              <select value={role} onChange={e => setRole(e.target.value)} className={inputCls} required>
                <option value="">— Select role —</option>
                {SUGGESTED_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <button type="button" onClick={() => { setCustomRole(true); setRole('') }}
                className="text-xs text-brown-light hover:text-brown shrink-0 whitespace-nowrap">Custom</button>
            </div>
          )}
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-brown-light mb-1">
          Short bio <span className="font-normal">(optional — shown on your wedding website)</span>
        </label>
        <textarea value={bio} onChange={e => setBio(e.target.value)} rows={2}
          className={inputCls} placeholder="e.g. Jordan's best friend since college…" />
      </div>
      <div className="flex gap-3">
        <button type="submit" disabled={isPending}
          className="rounded-lg bg-gold px-5 py-2 text-sm font-semibold text-white hover:bg-gold-dark disabled:opacity-60 transition">
          {isPending ? 'Saving…' : initial ? 'Save changes' : 'Add member'}
        </button>
        <button type="button" onClick={onCancel}
          className="rounded-lg border border-gold-light px-5 py-2 text-sm font-medium text-brown hover:bg-ivory transition">
          Cancel
        </button>
      </div>
    </form>
  )
}
