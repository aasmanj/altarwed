import { defineConfig } from 'vitest/config'
import path from 'path'

// Resolve the same `@/` alias the app and eslint convention use, so tests can
// import via `@/lib/...` instead of relative parent paths (which eslint forbids).
//
// The app's tsconfig uses `jsx: preserve` (Next's SWC transforms JSX at build
// time). vitest transpiles with esbuild, which would otherwise fall back to the
// classic `React.createElement` transform and throw "React is not defined" when a
// test imports a JSX component that does not import React (the Next 18 default).
// Pinning esbuild to React's automatic runtime lets component tests import and
// exercise .tsx files directly. This only affects vitest; the production build is
// still driven by Next's own toolchain.
export default defineConfig({
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
