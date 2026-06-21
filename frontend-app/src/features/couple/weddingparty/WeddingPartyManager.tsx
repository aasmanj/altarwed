import React, { useEffect, useState } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { useConfirm } from '@/components/ConfirmDialog'
import {
  useWeddingParty, useAddMember, useUpdateMember, useDeleteMember, useUploadMemberPhoto,
  type WeddingPartyMember, type PartySide,
} from './useWeddingParty'
import { normalizeImageFile, IMAGE_ACCEPT } from '@/lib/normalizeImageFile'
import { cropToSquare } from '@/lib/imageCrop'
import ImageRepositionModal from '@/components/ImageRepositionModal'
import { framingStyle, apiFraming } from '@/lib/imageFraming'

const SUGGESTED_ROLES = [
  'Bride', 'Groom',
  'Maid of Honor', 'Matron of Honor', 'Best Man',
  'Bridesmaid', 'Groomsman',
  'Officiant / Pastor',
  'Flower Girl', 'Ring Bearer',
  'Mother of the Bride', 'Father of the Bride',
  'Mother of the Groom', 'Father of the Groom',
]

const inputCls = 'w-full rounded-lg border border-gold-light px-3 py-2 text-brown text-sm focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold'

// Add/edit/reorder wedding party members. Shared by the dedicated Wedding Party
// page and the in-editor drawer (so couples can manage members from the
// side-by-side builder without leaving the page they are designing).
export default function WeddingPartyManager({ websiteId }: { websiteId: string }) {
  const confirm = useConfirm()

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
  const [repositioning, setRepositioning] = useState<WeddingPartyMember | null>(null)

  const ordered      = [...members].sort((a, b) => a.sortOrder - b.sortOrder)
  const displayed    = sideFilter === 'ALL' ? ordered
    : ordered.filter(m => m.side === sideFilter)

  const [sideHintDismissed, setSideHintDismissed] = useState(false)
  const brideCount = members.filter(m => m.side === 'BRIDE').length
  const groomCount = members.filter(m => m.side === 'GROOM').length
  const showSideHint = !sideHintDismissed
    && ((brideCount >= 1 && groomCount === 0) || (groomCount >= 1 && brideCount === 0))
  const hintMissingSide = groomCount === 0 ? "groom's" : "bride's"

  const reorder = async (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= ordered.length) return
    const next = [...ordered]
    ;[next[index], next[target]] = [next[target], next[index]]
    await Promise.all(
      next.flatMap((m, i) =>
        m.sortOrder === i ? [] : [updateMember.mutateAsync({ memberId: m.id, payload: { sortOrder: i } })],
      ),
    )
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowAdd(v => !v)}
          className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-white hover:bg-gold-dark transition"
        >
          + Add member
        </button>
      </div>

      {/* Add member form */}
      {showAdd && (
        <MemberForm
          onSubmit={async (data, file) => {
            // Append new members at the end of the current order.
            const created = await addMember.mutateAsync({ ...data, sortOrder: ordered.length })
            if (file && created?.id) {
              await uploadPhoto.mutateAsync({ memberId: created.id, file })
            }
            setShowAdd(false)
          }}
          onCancel={() => setShowAdd(false)}
          isPending={addMember.isPending || uploadPhoto.isPending}
          allowPhoto
        />
      )}

      {/* Side filter */}
      {members.length > 0 && (
        <div className="flex gap-1 mb-6 border-b border-gold-light overflow-x-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
          {(['ALL', 'BRIDE', 'GROOM', 'NEUTRAL'] as const).map(f => (
            <button
              key={f}
              onClick={() => setSideFilter(f)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition whitespace-nowrap ${
                sideFilter === f ? 'border-gold text-brown' : 'border-transparent text-brown-light hover:text-brown'
              }`}
            >
              {f === 'ALL' ? 'All' : f === 'BRIDE' ? "Bride's side" : f === 'GROOM' ? "Groom's side" : 'Ceremony'}
            </button>
          ))}
        </div>
      )}

      {showSideHint && (
        <div className="flex items-start justify-between gap-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 mb-4 text-sm text-amber-900">
          <p>Your {hintMissingSide} party members won't appear on your wedding website. Add them here to complete your wedding party.</p>
          <button
            onClick={() => setSideHintDismissed(true)}
            aria-label="Dismiss"
            className="shrink-0 text-amber-700 hover:text-amber-900 transition"
          >✕</button>
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
          <p className="text-sm text-brown-light">Add your wedding party. Members you add here can be included in your ceremony builder and printed program.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {displayed.map((member) => {
            const globalIdx = ordered.findIndex(m => m.id === member.id)
            return editingId === member.id ? (
              <MemberForm
                key={member.id}
                initial={member}
                onSubmit={async (data) => {
                  await updateMember.mutateAsync({ memberId: member.id, payload: data })
                  setEditingId(null)
                }}
                onCancel={() => setEditingId(null)}
                isPending={updateMember.isPending}
                allowPhoto={false}
              />
            ) : (
              <MemberCard
                key={member.id}
                member={member}
                onEdit={() => setEditingId(member.id)}
                onDelete={async () => {
                  if (await confirm({
                    title: `Remove ${member.name}?`,
                    message: 'They will be removed from your wedding party and your public wedding website.',
                    tone: 'danger',
                    confirmLabel: 'Remove',
                  })) deleteMember.mutate(member.id)
                }}
                onPhotoUpload={(file) => uploadPhoto.mutate({ memberId: member.id, file })}
                onReposition={() => setRepositioning(member)}
                isUploading={uploadPhoto.isPending}
                reorder={sideFilter === 'ALL' ? {
                  canUp: globalIdx > 0,
                  canDown: globalIdx < ordered.length - 1,
                  onUp: () => reorder(globalIdx, -1),
                  onDown: () => reorder(globalIdx, 1),
                  busy: updateMember.isPending,
                } : undefined}
              />
            )
          })}
        </div>
      )}

      {repositioning && repositioning.photoUrl && (
        <ImageRepositionModal
          src={repositioning.photoUrl}
          shape="circle"
          aspect={1}
          title={`Reposition ${repositioning.name}'s photo`}
          initial={apiFraming(repositioning)}
          saving={updateMember.isPending}
          onCancel={() => setRepositioning(null)}
          onSave={async ({ focalX, focalY, zoom }) => {
            await updateMember.mutateAsync({
              memberId: repositioning.id,
              payload: { focalPointX: focalX, focalPointY: focalY, zoom },
            })
            setRepositioning(null)
          }}
        />
      )}
    </div>
  )
}

interface ReorderControls {
  canUp: boolean
  canDown: boolean
  onUp: () => void
  onDown: () => void
  busy: boolean
}

function MemberCard({ member, onEdit, onDelete, onPhotoUpload, onReposition, isUploading, reorder }: {
  member: WeddingPartyMember
  onEdit: () => void
  onDelete: () => void
  onPhotoUpload: (file: File) => void
  onReposition: () => void
  isUploading: boolean
  reorder?: ReorderControls
}) {
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  return (
    <div className="rounded-xl border border-gold-light bg-white p-5 flex gap-5 items-start">
      <div className="relative shrink-0 group">
        {member.photoUrl ? (
          <div className="h-16 w-16 rounded-full overflow-hidden border border-gold-light bg-ivory">
            <img
              src={member.photoUrl}
              alt={member.name}
              className="h-full w-full"
              style={framingStyle(apiFraming(member))}
            />
          </div>
        ) : (
          <div className="h-16 w-16 rounded-full bg-ivory border border-gold-light flex items-center justify-center">
            <span className="text-2xl text-brown-light font-serif">{member.name.charAt(0)}</span>
          </div>
        )}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition flex items-center justify-center disabled:cursor-wait"
          title="Upload photo"
        >
          <span className="text-white text-xs font-medium">{isUploading ? '…' : '📷'}</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept={IMAGE_ACCEPT}
          className="hidden"
          onChange={async e => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) onPhotoUpload(await normalizeImageFile(file))
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
          <div className="flex items-center gap-3 shrink-0">
            {reorder && (
              <div className="flex flex-col -my-1">
                <button
                  onClick={reorder.onUp}
                  disabled={!reorder.canUp || reorder.busy}
                  aria-label={`Move ${member.name} up`}
                  className="text-brown-light hover:text-brown disabled:opacity-30 transition"
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  onClick={reorder.onDown}
                  disabled={!reorder.canDown || reorder.busy}
                  aria-label={`Move ${member.name} down`}
                  className="text-brown-light hover:text-brown disabled:opacity-30 transition"
                >
                  <ChevronDown size={16} />
                </button>
              </div>
            )}
            {member.photoUrl && (
              <button onClick={onReposition} className="text-xs text-brown-light hover:text-brown transition">Reposition</button>
            )}
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

function MemberForm({ initial, onSubmit, onCancel, isPending, allowPhoto = false }: {
  initial?: WeddingPartyMember
  onSubmit: (
    data: { name: string; role: string; side: PartySide; bio?: string },
    file?: File,
  ) => Promise<void>
  onCancel: () => void
  isPending: boolean
  // Only the "add new member" entry point shows the photo field; editing photos
  // on existing members happens via the click-the-avatar hover overlay below.
  allowPhoto?: boolean
}) {
  const [name, setName]   = useState(initial?.name ?? '')
  const [role, setRole]   = useState(initial?.role ?? '')
  const [side, setSide]   = useState<PartySide>(initial?.side ?? 'BRIDE')
  const [bio, setBio]     = useState(initial?.bio ?? '')
  // A new member defaults to the curated dropdown (the whole point of the picker).
  // Only an *existing* member whose saved role isn't in the list opens in free-text
  // so we don't lose the custom value they previously typed.
  const [customRole, setCustomRole] = useState(
    initial != null && !SUGGESTED_ROLES.includes(initial.role),
  )
  const [croppedFile, setCroppedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl]   = useState<string | null>(null)
  const [cropError, setCropError]     = useState<string | null>(null)
  const [isCropping, setIsCropping]   = useState(false)

  // Revoke the object URL when the preview changes or the form unmounts so we
  // don't leak blob: URLs across the session.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const handlePhotoPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0]
    e.target.value = ''
    if (!picked) return
    setCropError(null)
    setIsCropping(true)
    try {
      // Convert HEIC/HEIF first (canvas in cropToSquare cannot decode them).
      const file = await normalizeImageFile(picked)
      if (file.size > 15 * 1024 * 1024) {
        setCropError('Photo must be under 15 MB.')
        return
      }
      const cropped = await cropToSquare(file)
      setCroppedFile(cropped)
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(URL.createObjectURL(cropped))
    } catch {
      setCropError('Could not read that image. Try a JPEG or PNG.')
    } finally {
      setIsCropping(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(
      { name: name.trim(), role: role.trim(), side, bio: bio.trim() || undefined },
      croppedFile ?? undefined,
    )
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
                <option value="">Select a role</option>
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
          Short bio <span className="font-normal">(optional, shown on your wedding website)</span>
        </label>
        <textarea value={bio} onChange={e => setBio(e.target.value)} rows={2}
          className={inputCls} placeholder="Optional. One sentence on how you know them." />
      </div>
      {allowPhoto && (
        <div>
          <label className="block text-xs font-medium text-brown-light mb-1">
            Photo <span className="font-normal">(optional, auto-cropped square)</span>
          </label>
          <div className="flex items-center gap-3">
            {previewUrl ? (
              <img src={previewUrl} alt="Preview"
                className="h-14 w-14 rounded-full object-cover border border-gold-light" />
            ) : (
              <div className="h-14 w-14 rounded-full bg-ivory border border-gold-light flex items-center justify-center text-brown-light text-lg">
                ?
              </div>
            )}
            <label className="text-sm text-gold hover:underline cursor-pointer">
              {isCropping ? 'Processing…' : croppedFile ? 'Change photo' : 'Upload photo'}
              <input type="file" accept={IMAGE_ACCEPT}
                className="hidden" onChange={handlePhotoPick} disabled={isCropping} />
            </label>
            {croppedFile && (
              <button type="button" onClick={() => {
                if (previewUrl) URL.revokeObjectURL(previewUrl)
                setCroppedFile(null)
                setPreviewUrl(null)
              }} className="text-xs text-brown-light hover:text-brown">Remove</button>
            )}
          </div>
          {cropError && <p className="text-xs text-red-600 mt-1">{cropError}</p>}
        </div>
      )}
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
