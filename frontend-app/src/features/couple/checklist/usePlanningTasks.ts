import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiClient } from '@/core/api/client'
import { errorDetail } from '@/lib/apiError'

export type TaskCategory =
  | 'FAITH' | 'CEREMONY' | 'VENUE' | 'VENDORS'
  | 'LEGAL' | 'ATTIRE' | 'GUESTS' | 'RECEPTION' | 'HONEYMOON'

export interface PlanningTask {
  id: string
  coupleId: string
  title: string
  category: TaskCategory
  dueMonthsBefore: number | null
  isCompleted: boolean
  completedAt: string | null
  isSeeded: boolean
  sortOrder: number
  notes: string | null
  assignee: string | null
}

export interface CreateTaskPayload {
  title: string
  category: TaskCategory
  dueMonthsBefore?: number | null
}

const key = (coupleId: string) => ['planning-tasks', coupleId]

export function usePlanningTasks(coupleId: string) {
  return useQuery<PlanningTask[]>({
    queryKey: key(coupleId),
    queryFn: () => apiClient.get(`/api/v1/planning-tasks/couple/${coupleId}`).then(r => r.data),
  })
}

interface UpdateTaskPayload {
  taskId: string
  isCompleted?: boolean
  notes?: string
  assignee?: string
}

export function useToggleTask(coupleId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, ...rest }: UpdateTaskPayload) =>
      apiClient.patch(`/api/v1/planning-tasks/couple/${coupleId}/${taskId}`, rest).then(r => r.data),
    onMutate: async ({ taskId, isCompleted, notes, assignee }) => {
      await qc.cancelQueries({ queryKey: key(coupleId) })
      const previous = qc.getQueryData<PlanningTask[]>(key(coupleId))
      qc.setQueryData<PlanningTask[]>(key(coupleId), old =>
        old?.map(t => {
          if (t.id !== taskId) return t
          return {
            ...t,
            ...(isCompleted !== undefined ? { isCompleted } : {}),
            ...(notes !== undefined ? { notes: notes || null } : {}),
            ...(assignee !== undefined ? { assignee: assignee || null } : {}),
          }
        }) ?? []
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(key(coupleId), ctx.previous)
      toast.error('Could not save your task change. Please try again.')
    },
    onSuccess: (updated: PlanningTask) =>
      qc.setQueryData<PlanningTask[]>(key(coupleId), old =>
        old?.map(t => t.id === updated.id ? updated : t) ?? []
      ),
  })
}

export function useAddTask(coupleId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateTaskPayload) =>
      apiClient.post(`/api/v1/planning-tasks/couple/${coupleId}`, payload).then(r => r.data),
    onSuccess: (task: PlanningTask) =>
      qc.setQueryData<PlanningTask[]>(key(coupleId), old => old ? [...old, task] : [task]),
    // No optimistic update, so nothing to roll back; surface the backend reason
    // (a ProblemDetail from validation) instead of failing silently (issue #302).
    onError: (err: unknown) => toast.error(errorDetail(err)),
  })
}

export function useDeleteTask(coupleId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (taskId: string) =>
      apiClient.delete(`/api/v1/planning-tasks/couple/${coupleId}/${taskId}`),
    // Optimistic removal with snapshot rollback, matching useRemoveGuest and
    // useDeletePhoto so every couple-side delete behaves the same (issue #302).
    onMutate: async (taskId) => {
      await qc.cancelQueries({ queryKey: key(coupleId) })
      const previous = qc.getQueryData<PlanningTask[]>(key(coupleId))
      qc.setQueryData<PlanningTask[]>(key(coupleId), old => old?.filter(t => t.id !== taskId) ?? [])
      return { previous }
    },
    onError: (err: unknown, _taskId, ctx) => {
      if (ctx?.previous) qc.setQueryData(key(coupleId), ctx.previous)
      toast.error(errorDetail(err, 'Could not delete the task. Please try again.'))
    },
  })
}
