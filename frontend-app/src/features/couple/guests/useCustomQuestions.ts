import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/core/api/client'

export type QuestionType = 'TEXT' | 'YES_NO' | 'CHOICE'

export interface CustomQuestion {
  id: string
  coupleId: string
  questionText: string
  type: QuestionType
  options: string[]
  required: boolean
  sortOrder: number
  active: boolean
}

export interface CreateCustomQuestionPayload {
  questionText: string
  type: QuestionType
  options?: string[]
  required?: boolean
}

export interface UpdateCustomQuestionPayload {
  questionText?: string
  type?: QuestionType
  options?: string[]
  required?: boolean
  sortOrder?: number
  active?: boolean
}

export interface QuestionAnswers {
  questionId: string
  questionText: string
  type: QuestionType
  answers: { guestId: string; guestName: string; answerText: string }[]
}

const key = (coupleId: string) => ['custom-questions', coupleId]
const answersKey = (coupleId: string) => ['custom-questions', coupleId, 'answers']

export function useCustomQuestions(coupleId: string) {
  return useQuery<CustomQuestion[]>({
    queryKey: key(coupleId),
    queryFn: () => apiClient.get(`/api/v1/custom-rsvp-questions/couple/${coupleId}`).then(r => r.data),
    enabled: !!coupleId,
  })
}

export function useCustomQuestionAnswers(coupleId: string) {
  return useQuery<QuestionAnswers[]>({
    queryKey: answersKey(coupleId),
    queryFn: () => apiClient.get(`/api/v1/custom-rsvp-questions/couple/${coupleId}/answers`).then(r => r.data),
    enabled: !!coupleId,
  })
}

export function useCreateCustomQuestion(coupleId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateCustomQuestionPayload) =>
      apiClient.post(`/api/v1/custom-rsvp-questions/couple/${coupleId}`, payload).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(coupleId) }),
  })
}

export function useUpdateCustomQuestion(coupleId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ questionId, payload }: { questionId: string; payload: UpdateCustomQuestionPayload }) =>
      apiClient.patch(`/api/v1/custom-rsvp-questions/couple/${coupleId}/${questionId}`, payload).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(coupleId) }),
  })
}

export function useDeleteCustomQuestion(coupleId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (questionId: string) =>
      apiClient.delete(`/api/v1/custom-rsvp-questions/couple/${coupleId}/${questionId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key(coupleId) })
      // Deleting a question removes its answers too, so refresh the analytics view.
      qc.invalidateQueries({ queryKey: answersKey(coupleId) })
    },
  })
}
