import { defineConfig } from 'vitest/config'
import path from 'path'

// Resolve the same `@/` alias the app and eslint convention use, so tests can
// import via `@/lib/...` instead of relative parent paths (which eslint forbids).
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
