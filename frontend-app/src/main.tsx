import React, { StrictMode } from 'react'
import ReactDOM, { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import App from './App'
import './index.css'
import { initAnalytics } from '@/core/analytics/analytics'
import { captureUtmFromUrl } from '@/core/analytics/utm'

// Record first-touch attribution from the landing URL before anything navigates,
// then boot product analytics. captureUtmFromUrl is always safe (it only reads
// the URL + localStorage); initAnalytics is a no-op until VITE_POSTHOG_KEY is set.
captureUtmFromUrl()
initAnalytics()

// Dev-only: log a11y violations to the console as the UI mounts/updates.
// Zero prod overhead, Vite tree-shakes the import out of the prod bundle.
if (import.meta.env.DEV) {
  import('@axe-core/react').then(axe => {
    axe.default(React, ReactDOM, 1000)
  })
}

const queryClient = new QueryClient({
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
