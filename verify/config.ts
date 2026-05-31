import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// Single typed source of the verify config for the TS (Playwright) side. Reading
// via fs avoids JSON import-attribute syntax, which not every TS transpiler
// accepts. The Node seed scripts read the same file directly.
const here = dirname(fileURLToPath(import.meta.url))

export interface VerifyConfig {
  apiUrl: string
  appUrl: string
  publicUrl: string
  slug: string
  couple: { partnerOneName: string; partnerTwoName: string; email: string; password: string }
}

export const cfg: VerifyConfig = JSON.parse(
  readFileSync(join(here, 'verify.config.json'), 'utf8'),
)
