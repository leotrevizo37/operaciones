import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const frontendPort = Number(process.env.DUMA_EXPERIENCE_FRONTEND_PORT ?? 5174)
const backendPort = Number(process.env.DUMA_EXPERIENCE_BACKEND_PORT ?? process.env.EXPERIENCE_PORT ?? 8081)

export default defineConfig({
  plugins: [react()],
  server: { port: frontendPort, strictPort: true, proxy: { '/api': `http://localhost:${backendPort}`, '/actuator': `http://localhost:${backendPort}` } },
  preview: { port: frontendPort, strictPort: true },
  build: {
    outDir: '../backend/src/main/resources/static',
    emptyOutDir: true,
    rollupOptions: {
      input: { app: resolve(__dirname, 'index.html'), 'remote-entry': resolve(__dirname, 'src/element.tsx') },
      output: { entryFileNames: (chunk) => chunk.name === 'remote-entry' ? 'remote-entry.js' : 'assets/[name]-[hash].js' },
    },
  },
  test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'], exclude: ['e2e/**', 'node_modules/**'] },
})
