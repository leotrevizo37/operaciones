import { preview } from 'vite'

export default async function globalSetup() {
  const port = Number(process.env.DUMA_READINGS_FRONTEND_PORT ?? 5175)
  const server = await preview({ preview: { host: '127.0.0.1', port, strictPort: true } })
  return async () => {
    await new Promise<void>((resolve, reject) => {
      server.httpServer.close(error => error ? reject(error) : resolve())
    })
  }
}
