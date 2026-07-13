import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { exclude: ['test/rules.test.js', 'node_modules/**', 'e2e/**'] } })
