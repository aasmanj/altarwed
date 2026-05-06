import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/core/api/client'

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

export function useToggleTask(coupleId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, isCompleted }: { taskId: string; isCompleted: boolean }) =>
      apiClient.patch(`/api/v1/planning-tasks/couple/${coupleId}/${taskId}`, { isCompleted }).then(r => r.data),
    onMutate: async ({ taskId, isCompleted }) => {
      await qc.cancelQueries({ queryKey: key(coupleId) })
      const previous = qc.getQueryData<PlanningTask[]>(key(coupleId))
      qc.setQueryData<PlanningTask[]>(key(coupleId), old =>
        old?.map(t => t.id === taskId ? { ...t, isCompleted } : t) ?? []
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(key(coupleId), ctx.previous)
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
  })
}

export function useDeleteTask(coupleId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (taskId: string) =>
      apiClient.delete(`/api/v1/planning-tasks/couple/${coupleId}/${taskId}`),
    onSuccess: (_data, taskId) =>
      qc.setQueryData<PlanningTask[]>(key(coupleId), old => old?.filter(t => t.id !== taskId) ?? []),
  })
}
