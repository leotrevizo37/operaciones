import { useEffect, useRef, useState } from 'react'
import { apiFetch } from './api'
import type { DumaModuleElement, ModuleFreshness, ModuleHostContext, ModuleRegistration, Session } from './types'

type Props = {
  module: ModuleRegistration
  session: Session
  tenantIds: string[]
  period: { from: string; to: string }
  filters: { location: string; device: string; sensor: string }
  freshness: ModuleFreshness[]
  onNavigate: (moduleId: string) => void
}

type TokenResponse = { accessToken: string; tokenType: string; expiresIn: number }
type ModuleReadyDetail = { protocolVersion?: unknown; moduleId?: unknown; capabilities?: unknown }

export function ModuleHost({ module, session, tenantIds, period, filters, freshness, onNavigate }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let disposed = false
    let element: DumaModuleElement | null = null
    const host = hostRef.current

    async function mount() {
      setState('loading')
      try {
        await import(/* @vite-ignore */ module.remoteEntryUrl)
        await customElements.whenDefined(module.customElement)
        if (disposed || !host) return
        element = document.createElement(module.customElement) as DumaModuleElement
        const timeout = window.setTimeout(() => setState('error'), 10_000)
        element.addEventListener('duma:module-ready', (event) => {
          window.clearTimeout(timeout)
          const detail = (event as CustomEvent<ModuleReadyDetail>).detail
          const capabilities = Array.isArray(detail?.capabilities) && detail.capabilities.every((value) => typeof value === 'string')
            ? detail.capabilities
            : null
          if (detail?.protocolVersion !== '1.0' || detail.moduleId !== module.moduleId || !capabilities || !module.capabilities.every((value) => capabilities.includes(value))) {
            element?.remove()
            setState('error')
            return
          }
          setState('ready')
        }, { once: true })
        element.addEventListener('duma:module-error', () => {
          window.clearTimeout(timeout)
          setState('error')
        })
        const context: ModuleHostContext = {
          protocolVersion: '1.0',
          moduleId: module.moduleId,
          locale: 'es-MX',
          timezone: 'America/Mexico_City',
          tenantIds,
          period,
          filters,
          freshness,
          identity: session,
          apiBaseUrl: module.apiBaseUrl,
          auth: {
            getAccessToken: async (moduleId) => {
              const token = await apiFetch<TokenResponse>('/api/integration/token', {
                method: 'POST',
                body: JSON.stringify({ moduleId }),
              })
              return token.accessToken
            },
          },
          navigate: (target) => onNavigate(target.moduleId),
        }
        host.replaceChildren(element)
        element.setHostContext(context)
      } catch {
        setState('error')
      }
    }

    void mount()
    return () => {
      disposed = true
      element?.remove()
    }
  }, [filters, freshness, module, onNavigate, period, session, tenantIds])

  return (
    <section className="module-frame" aria-busy={state === 'loading'}>
      {state === 'loading' && <div className="module-state"><strong>Cargando modulo</strong><span>Validando contrato e identidad.</span></div>}
      {state === 'error' && <div className="module-state module-state-error"><strong>No fue posible integrar este modulo</strong><span>Los demas dominios siguen disponibles. Verifique su etapa de liberacion y endpoint.</span></div>}
      <div ref={hostRef} className={state === 'ready' ? 'module-mounted' : 'module-pending'} />
    </section>
  )
}
