import {defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    // .codex/ mirrors skills/ and assets/ as real files (see scripts/sync-codex-artifacts.js).
    // Exclude it so tests in the mirrored copy don't run twice.
    exclude: ['**/node_modules/**', '.codex/**']
  }
})
