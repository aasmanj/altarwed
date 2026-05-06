import { useState, useRef } from 'react'
import { useAuth } from '@/core/auth/AuthContext'
import PageHeader from '@/components/PageHeader'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/core/api/client'
import { useWeddingWebsite } from '@/features/couple/website/useWeddingWebsite'

interface Photo {
  id: string
  url: string
  caption: string | null
  sortOrder: number
}

function usePhotos(websiteId: string) {
  return useQuery<Photo[]>({
    queryKey: ['wedding-photos', websiteId],
    queryFn: () => apiClient.get(`/api/v1/wedding-photos/website/${websiteId}`).then(r => r.data),
    enabled: !!websiteId,
  })
}

function useUploadPhoto(websiteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ file, caption }: { file: File; caption: string }) => {
      const form = new FormData()
      form.append('file', file)
      if (caption) form.append('caption', caption)
      return apiClient.post(`/api/v1/uploads/wedding-websites/${websiteId}/photos`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then(r => r.data)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wedding-photos', websiteId] }),
  })
}

function useDeletePhoto(websiteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (photoId: string) =>
      apiClient.delete(`/api/v1/wedding-photos/website/${websiteId}/${photoId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wedding-photos', websiteId] }),
  })
}

function useUpdateCaption(websiteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ photoId, caption }: { photoId: string; caption: string }) =>
      apiClient.patch(`/api/v1/wedding-photos/website/${websiteId}/${photoId}`, { caption }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wedding-photos', websiteId] }),
  })
}

export default function PhotosPage() {
  const { user } = useAuth()
  const coupleId = user?.id ?? ''
  const { data: website } = useWeddingWebsite(coupleId)
  const websiteId = website?.id ?? ''

  const { data: photos = [], isLoading } = usePhotos(websiteId)
  const upload = useUploadPhoto(websiteId)
  const deletePhoto = useDeletePhoto(websiteId)
  const updateCaption = useUpdateCaption(websiteId)

  const fileRef = useRef<HTMLInputElement>(null)
  const [caption, setCaption] = useState('')
  const [editingCaption, setEditingCaption] = useState<{ id: string; value: string } | null>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !websiteId) return
    upload.mutate({ file, caption })
    setCaption('')
    e.target.value = ''
  }

  if (!websiteId || isLoading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-amber-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  const publicUrl = `https://www.altarwed.com/wedding/${website?.slug}/photos`

  return (
    <div className="min-h-screen bg-ivory">
      <PageHeader
        title="Wedding Photos"
        subtitle="Share your memories with guests"
        action={
          <a href={publicUrl} target="_blank" rel="noopener noreferrer"
            className="text-sm text-gold hover:underline">
            View public page ↗
          </a>
        }
      />

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* Upload section */}
        <div className="bg-white rounded-xl border border-stone-200 p-6">
          <h2 className="font-semibold text-stone-900 mb-4">Add Photo</h2>
          <div className="flex gap-3 items-end flex-wrap">
            <div className="flex-1 min-w-[180px]">
              <label className="block text-sm text-stone-600 mb-1">Caption (optional)</label>
              <input
                value={caption}
                onChange={e => setCaption(e.target.value)}
                placeholder="A moment to remember…"
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={upload.isPending}
              className="px-5 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors"
            >
              {upload.isPending ? 'Uploading…' : '+ Upload Photo'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
          <p className="text-xs text-stone-400 mt-2">JPEG, PNG, or WebP · Max 15 MB · Photos appear on your public wedding page</p>
        </div>

        {/* Photo grid */}
        {photos.length === 0 ? (
          <div className="bg-white rounded-xl border border-stone-200 p-16 text-center">
            <div className="text-5xl mb-4">📷</div>
            <h3 className="text-lg font-medium text-stone-800 mb-2">No photos yet</h3>
            <p className="text-stone-500 text-sm mb-6">Upload your first photo to share your journey with guests.</p>
            <button
              onClick={() => fileRef.current?.click()}
              className="px-5 py-2.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700"
            >
              Upload First Photo
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {photos.sort((a, b) => a.sortOrder - b.sortOrder).map(photo => (
              <div key={photo.id} className="group relative bg-white rounded-xl overflow-hidden border border-stone-200 shadow-sm">
                <img
                  src={photo.url}
                  alt={photo.caption ?? 'Wedding photo'}
                  className="w-full aspect-square object-cover"
                />
                {/* Overlay controls */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                  <button
                    onClick={() => setEditingCaption({ id: photo.id, value: photo.caption ?? '' })}
                    className="p-2 bg-white rounded-full shadow text-stone-700 hover:text-amber-600"
                    title="Edit caption"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Remove this photo?')) deletePhoto.mutate(photo.id)
                    }}
                    className="p-2 bg-white rounded-full shadow text-stone-700 hover:text-rose-600"
                    title="Delete photo"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
                {photo.caption && (
                  <div className="px-3 py-2">
                    <p className="text-xs text-stone-500 truncate">{photo.caption}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit caption modal */}
      {editingCaption && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold text-stone-900 mb-4">Edit Caption</h2>
            <textarea
              value={editingCaption.value}
              onChange={e => setEditingCaption(c => c ? { ...c, value: e.target.value } : null)}
              rows={3}
              placeholder="Describe this moment…"
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setEditingCaption(null)}
                className="flex-1 py-2.5 border border-stone-300 rounded-lg text-sm font-medium text-stone-700 hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  updateCaption.mutate({ photoId: editingCaption.id, caption: editingCaption.value })
                  setEditingCaption(null)
                }}
                className="flex-1 py-2.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
