import React, { StrictMode } from 'react'
import ReactDOM, { createRoot } from 'react-dom/client'
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { toast } from 'sonner'
import App from './App'
import './index.css'
import { captureUtmFromUrl } from '@/core/analytics/utm'

// Record first-touch attribution from the landing URL before anything navigates.
// captureUtmFromUrl is always safe (it only reads the URL + localStorage) and is
// not analytics: it stashes UTM params for later use once consent is granted.
//
// PostHog is deliberately NOT initialized here. Analytics boots only from the
// AuthContext consent gate, keyed on the couple's persisted marketing-consent
// flag, so no PostHog network activity happens before consent (issue #218).
captureUtmFromUrl()

// Dev-only: log a11y violations to the console as the UI mounts/updates.
// Zero prod overhead, Vite tree-shakes the import out of the prod bundle.
if (import.meta.env.DEV) {
  import('@axe-core/react').then(axe => {
    axe.default(React, ReactDOM, 1000)
  })
}

const queryClient = new QueryClient({
  // Global fallback for mutations with no onError handler (issue #95). React
  // Query runs this BEFORE each mutation's own onError, so we skip the generic
  // toast when a mutation already declares onError, avoiding double toasts. Note:
  // mutations with rollback-only onError handlers are exempted by this guard and
  // still fail without a toast; those are tracked separately.
  mutationCache: new MutationCache({
    onError: (_error, _variables, _context, mutation) => {
      if (mutation.options.onError) return
      toast.error('Something went wrong. Please try again.')
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </StrictMode>,
)
