import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import type { HostContext } from './types'

const to = new Date().toISOString().slice(0, 10)
const fromDate = new Date()
fromDate.setUTCDate(fromDate.getUTCDate() - 30)

const standaloneContext: HostContext = {
  protocolVersion: '1.0', moduleId: 'experiencia-digital', locale: 'es-MX', timezone: 'America/Mexico_City', tenantIds: [],
  period: { from: fromDate.toISOString().slice(0, 10), to },
  identity: { subject: 'standalone-read', displayName: 'Modo standalone', roles: [], permissions: [], tenantScope: [] },
  apiBaseUrl: '', auth: { getAccessToken: async () => '' }, navigate: () => undefined,
}

createRoot(document.getElementById('root')!).render(<StrictMode><App context={standaloneContext} /></StrictMode>)
