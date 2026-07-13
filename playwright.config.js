import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  // Every spec file shares (and wipes) the one emulator database — serialize.
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5173',
  },
  webServer: {
    // --host 127.0.0.1: vite's default "localhost" bind can land on ::1 only,
    // which the webServer health check (and the tests) at 127.0.0.1 never see.
    command: 'VITE_USE_EMULATOR=true npm run dev -- --port 5173 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
  },
})
