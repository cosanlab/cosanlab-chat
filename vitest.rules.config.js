import { defineConfig } from 'vitest/config'
// Separate config for the emulator-backed rules suite: it must be able to
// select test/rules.test.js, which vitest.config.js deliberately excludes
// from the plain `npm test` run (see that file's comment).
export default defineConfig({ test: { include: ['test/rules.test.js'] } })
