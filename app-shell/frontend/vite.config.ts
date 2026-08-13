import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const frontendPort = Number(process.env.DUMA_SHELL_FRONTEND_PORT ?? 5173)
const backendPort = Number(process.env.DUMA_SHELL_BACKEND_PORT ?? process.env.APP_SHELL_PORT ?? 8080)

export default defineConfig({
  plugins: [react()],
  server: {
    port: frontendPort,
    strictPort: true,
    proxy: {
      '/api': `http://localhost:${backendPort}`,
      '/actuator': `http://localhost:${backendPort}`,
    },
  },
  preview: { port: frontendPort, strictPort: true },
  build: {
    outDir: '../backend/src/main/resources/static',
    emptyOutDir: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
  },
})
