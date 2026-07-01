import { useCallback, useEffect, useState, useRef, type ReactNode, type CSSProperties } from 'react'
import { Camera, ExternalLink, X, Crop, GripVertical } from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, rectSortingStrategy, useSortable, sortableKeyboardCoordinates, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useAuth } from '@/core/auth/AuthContext'
import PageHeader from '@/components/PageHeader'
import { useConfirm } from '@/components/ConfirmDialog'
import QueryErrorState from '@/components/QueryErrorState'
import { useModalA11y } from '@/lib/useModalA11y'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/core/api/client'
import { useWeddingWebsite } from '@/features/couple/website/useWeddingWebsite'
import { normalizeImageFile, isAllowedImageType, IMAGE_ACCEPT } from '@/lib/normalizeImageFile'
import { MAX_UPLOAD_LABEL } from '@/lib/upload'
import { toast } from 'sonner'
import ImageRepositionModal from '@/components/ImageRepositionModal'
import { framingStyle, apiFraming } from '@/lib/imageFraming'
import { runPhotoBatch, summarizePhotoBatch } from './photoBatchUpload'

interface Photo {
  id: string
  url: string
  caption: string | null
  sortOrder: number
  // Non-destructive framing (backend V70). null = centered / no zoom.
  focalPointX: number | null
  focalPointY: number | null
  zoom: number | null
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

// Exported so the reorder rollback/toast behavior can be unit-tested (issue #134);
// the component still uses it internally.
export function useReorderPhotos(websiteId: string) {
  const qc = useQueryClient()
  const key = ['wedding-photos', websiteId]
  return useMutation({
    mutationFn: (orderedIds: string[]) =>
      apiClient.patch(`/api/v1/wedding-photos/website/${websiteId}/reorder`, { orderedIds }),
    // Optimistic: drag should feel instant. Reassign sortOrder by the new index so the
    // grid re-renders in order immediately; roll back to the snapshot if the server rejects.
    onMutate: async (orderedIds) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<Photo[]>(key)
      qc.setQueryData<Photo[]>(key, old =>
        old ? orderedIds.map((id, i) => ({ ...old.find(p => p.id === id)!, sortOrder: i })) : old)
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev)
      toast.error('Could not save the new photo order. Please try again.')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })
}

function useUpdatePhotoFraming(websiteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ photoId, focalX, focalY, zoom }: { photoId: string; focalX: number; focalY: number; zoom: number }) =>
      apiClient.patch(`/api/v1/wedding-photos/website/${websiteId}/${photoId}`,
        { focalPointX: focalX, focalPointY: focalY, zoom }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wedding-photos', websiteId] }),
  })
}

export default function PhotosPage() {
  const { user } = useAuth()
  const coupleId = user?.id ?? ''
  const { data: website } = useWeddingWebsite(coupleId)
  const websiteId = website?.id ?? ''
  const confirm = useConfirm()

  const { data: photos = [], isLoading, isError, refetch } = usePhotos(websiteId)
  const upload = useUploadPhoto(websiteId)
  const deletePhoto = useDeletePhoto(websiteId)
  const updateCaption = useUpdateCaption(websiteId)
  const updateFraming = useUpdatePhotoFraming(websiteId)
  const reorder = useReorderPhotos(websiteId)

  // Mouse needs an 8px drag before it counts (so clicks on the card buttons still
  // work); touch waits 250ms (so scrolling the album does not start a drag); keyboard
  // sensor makes reordering operable without a pointer (a11y).
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const fileRef = useRef<HTMLInputElement>(null)
  const [caption, setCaption] = useState('')
  const [editingCaption, setEditingCaption] = useState<{ id: string; value: string } | null>(null)
  const [repositioning, setRepositioning] = useState<Photo | null>(null)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null)

  // Close lightbox on Escape
  useEffect(() => {
    if (!lightboxUrl) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightboxUrl(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightboxUrl])

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length || !websiteId) return
    e.target.value = ''

    // Per-file isolation lives in runPhotoBatch: one bad file (over the size
    // cap, unconvertible HEIC, network blip) must not brick the whole batch or
    // strand the spinner. uploadProgress is reset in finally no matter what.
    const total = files.length
    const singleCaption = total === 1 ? caption : ''
    setUploadProgress({ done: 0, total })
    let result
    try {
      result = await runPhotoBatch(files, {
        normalize: normalizeImageFile,
        isAllowedType: isAllowedImageType,
        upload: (file) => upload.mutateAsync({ file, caption: singleCaption }),
        onProgress: (done) => setUploadProgress({ done, total }),
      })
    } finally {
      setCaption('')
      setUploadProgress(null)
    }

    const summary = summarizePhotoBatch(result, total)
    if (summary.kind === 'success') toast.success(summary.message)
    else toast.error(summary.message)
  }

  const closeLightbox = useCallback(() => setLightboxUrl(null), [])
  const captionModalRef = useModalA11y(!!editingCaption, () => setEditingCaption(null))

  if (!websiteId || isLoading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center" aria-busy="true">
        <div className="animate-spin h-8 w-8 border-2 border-amber-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  // Distinguish a failed load from a genuinely empty album so couples are never
  // told "No photos yet" (and tempted to re-upload) when the fetch just failed.
  if (isError) {
    return (
      <div className="min-h-screen bg-ivory">
        <PageHeader title="Wedding Photos" subtitle="Share your memories with guests" />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          <QueryErrorState what="your photos" onRetry={() => refetch()} />
        </div>
      </div>
    )
  }

  const publicUrl = `https://www.altarwed.com/wedding/${website?.slug}/photos`
  const isUploading = !!uploadProgress

  // Stable display order (non-mutating copy) drives both the grid and the sortable list.
  const ordered = [...photos].sort((a, b) => a.sortOrder - b.sortOrder)

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const ids = ordered.map(p => p.id)
    reorder.mutate(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))))
  }

  return (
    <div className="min-h-screen bg-ivory">
      <PageHeader
        title="Wedding Photos"
        subtitle="Share your memories with guests"
        action={
          <a href={publicUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-gold hover:underline">
            View public page <ExternalLink size={14} />
          </a>
        }
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">

        {/* Upload section */}
        <div className="bg-white rounded-xl border border-stone-200 p-6">
          <h2 className="font-semibold text-stone-900 mb-4">Add Photos</h2>
          <div className="flex gap-3 items-end flex-wrap">
            <div className="flex-1 min-w-[180px]">
              <label className="block text-sm text-stone-600 mb-1">Caption (optional, single photo)</label>
              <input
                value={caption}
                onChange={e => setCaption(e.target.value)}
                placeholder="A moment to remember…"
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={isUploading}
              className="px-5 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors"
            >
              {isUploading
                ? `Uploading ${Math.min(uploadProgress!.done + 1, uploadProgress!.total)} of ${uploadProgress!.total}…`
                : '+ Upload Photos'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept={IMAGE_ACCEPT}
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
          <p className="text-xs text-stone-400 mt-2">JPEG, PNG, WebP, or HEIC · Max {MAX_UPLOAD_LABEL} · Select multiple photos at once</p>
        </div>

        {/* Photo grid */}
        {photos.length === 0 ? (
          <div className="bg-white rounded-xl border border-stone-200 p-16 text-center">
            <Camera className="w-12 h-12 mx-auto mb-4 text-stone-300" />
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
          <>
            {photos.length > 1 && (
              <p className="text-xs text-stone-400 -mt-2 mb-3">Drag a photo to reorder how it appears on your site.</p>
            )}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={ordered.map(p => p.id)} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {ordered.map(photo => (
                    <SortablePhotoCard key={photo.id} id={photo.id}>
                <button
                  type="button"
                  className="block w-full aspect-square overflow-hidden focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:outline-none"
                  aria-label={photo.caption ? `Enlarge photo: ${photo.caption}` : 'Enlarge photo'}
                  onClick={() => setLightboxUrl(photo.url)}
                >
                  <img
                    src={photo.url}
                    alt={photo.caption ?? 'Wedding photo'}
                    className="w-full h-full"
                    style={framingStyle(apiFraming(photo))}
                  />
                </button>
                {/* Overlay controls */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto">
                  <button
                    onClick={() => setRepositioning(photo)}
                    className="p-2 bg-white rounded-full shadow text-stone-700 hover:text-amber-600"
                    title="Reposition photo"
                  >
                    <Crop className="w-4 h-4" />
                  </button>
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
                    onClick={async () => {
                      if (await confirm({
                        title: 'Remove this photo?',
                        message: 'It will be removed from your public photo album.',
                        tone: 'danger',
                        confirmLabel: 'Remove',
                      })) deletePhoto.mutate(photo.id)
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
                    </SortablePhotoCard>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </>
        )}
      </div>

      {/* Reposition modal */}
      {repositioning && (
        <ImageRepositionModal
          src={repositioning.url}
          shape="rect"
          aspect={1}
          title="Reposition photo"
          initial={apiFraming(repositioning)}
          saving={updateFraming.isPending}
          onCancel={() => setRepositioning(null)}
          onSave={async ({ focalX, focalY, zoom }) => {
            await updateFraming.mutateAsync({ photoId: repositioning.id, focalX, focalY, zoom })
            setRepositioning(null)
          }}
        />
      )}

      {/* Edit caption modal */}
      {editingCaption && (
        <div className="fixed inset-0 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setEditingCaption(null)} aria-hidden="true" />
          <div
            ref={captionModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="caption-modal-title"
            className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm p-6 max-h-[90vh] overflow-y-auto"
          >
            <h2 id="caption-modal-title" className="text-lg font-semibold text-stone-900 mb-4">Edit Caption</h2>
            <textarea
              value={editingCaption.value}
              onChange={e => setEditingCaption(c => c ? { ...c, value: e.target.value } : null)}
              rows={3}
              aria-label="Photo caption"
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

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Photo enlarged view"
        >
          {/* Backdrop -- full-screen button so mouse and keyboard are both valid */}
          <button
            type="button"
            className="absolute inset-0 w-full h-full bg-black/90 cursor-default"
            onClick={closeLightbox}
            onKeyDown={e => { if (e.key === 'Escape') closeLightbox() }}
            aria-label="Close photo viewer"
            tabIndex={-1}
          />
          <div className="relative z-10 flex items-center justify-center w-full h-full">
            <button
              type="button"
              onClick={closeLightbox}
              className="absolute top-4 right-4 p-2 text-white/80 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label="Close enlarged photo"
            >
              <X size={24} />
            </button>
            <img
              src={lightboxUrl}
              alt="Enlarged view"
              className="max-w-full max-h-full object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  )
}

// One album cell, made sortable. The drag handle (grip, top-left) carries the dnd
// listeners so the card's own buttons (enlarge, reposition, caption, delete) keep
// working; touch-none on the handle stops the browser from scrolling mid-drag.
function SortablePhotoCard({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
    opacity: isDragging ? 0.4 : 1,
  }
  return (
    <div ref={setNodeRef} style={style} className="group relative bg-white rounded-xl overflow-hidden border border-stone-200 shadow-sm">
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder photo"
        className="absolute top-2 left-2 z-10 p-1 rounded-md bg-white/80 text-stone-500 hover:text-stone-800 shadow cursor-grab active:cursor-grabbing touch-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:outline-none"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      {children}
    </div>
  )
}
