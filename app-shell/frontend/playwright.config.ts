import { defineConfig } from '@playwright/test'

const frontendPort = Number(process.env.DUMA_SHELL_FRONTEND_PORT ?? 5173)
const frontendUrl = `http://127.0.0.1:${frontendPort}`

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  use: { baseURL: frontendUrl },
})
