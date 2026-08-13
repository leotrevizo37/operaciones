import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { apiFetch, clearCsrf, ensureCsrf } from './api'
import { ModuleBadge, ModuleStatusBadges } from './ModuleBadge'
import { ModuleHost } from './ModuleHost'
import type { ModuleRegistration, Session } from './types'

const tenants = [
  ['carlsjr', 'Carls Jr'],
  ['emerson', 'Emerson'],
  ['valledelencino', 'Valle del Encino'],
  ['mcdonalds', "McDonald's"],
  ['mcdonalds-cdp', "McDonald's CDP"],
  ['smartfit', 'SmartFit'],
  ['bafar-poc-gabinete', 'Bafar POC Gabinete'],
] as const

const pillars = [
  ['Higiene', 'smartaudits'],
  ['Mantenimiento', 'dispositivos'],
  ['Temperatura', 'lecturas'],
  ['Operaciones', 'experiencia-digital'],
  ['Cumplimiento', 'smartaudits'],
] as const

function isoDate(offsetDays: number) {
  const value = new Date()
  value.setUTCDate(value.getUTCDate() + offsetDays)
  return value.toISOString().slice(0, 10)
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [modules, setModules] = useState<ModuleRegistration[]>([])
  const [activeModuleId, setActiveModuleId] = useState('resumen')
  const [selectedTenants, setSelectedTenants] = useState<string[]>([])
  const [period, setPeriod] = useState({ from: isoDate(-30), to: isoDate(0) })
  const [authState, setAuthState] = useState<'loading' | 'anonymous' | 'authenticated'>('loading')
  const [loginError, setLoginError] = useState(false)

  const loadAuthenticatedState = useCallback(async () => {
    const currentSession = await apiFetch<Session>('/api/auth/me')
    const registrations = await apiFetch<ModuleRegistration[]>('/api/modules')
    setSession(currentSession)
    setModules(registrations)
    setAuthState('authenticated')
  }, [])

  useEffect(() => {
    void ensureCsrf()
      .then(loadAuthenticatedState)
      .catch(() => setAuthState('anonymous'))
  }, [loadAuthenticatedState])

  const activeModule = useMemo(
    () => modules.find((module) => module.moduleId === activeModuleId),
    [activeModuleId, modules],
  )

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setLoginError(false)
    try {
      await apiFetch<Session>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: form.get('username'), password: form.get('password') }),
      })
      await loadAuthenticatedState()
    } catch {
      setLoginError(true)
    }
  }

  async function logout() {
    await apiFetch<void>('/api/auth/logout', { method: 'POST' })
    clearCsrf()
    setSession(null)
    setModules([])
    setAuthState('anonymous')
    await ensureCsrf()
  }

  if (authState === 'loading') {
    return <main className="center-state"><strong>Preparando Duma Operaciones</strong><span>Validando sesion segura.</span></main>
  }

  if (authState === 'anonymous' || !session) {
    return (
      <main className="login-page">
        <section className="login-context">
          <span className="eyebrow">DUMA · OPERACIONES</span>
          <h1>La operacion completa, sin perder el contexto.</h1>
          <p>Resumen ICOS y modulos independientes con trazabilidad por tenant, fuente y etapa de liberacion.</p>
          <div className="privacy-band">Proyecto academico privado · acceso auditado</div>
        </section>
        <form className="login-card" onSubmit={login}>
          <div><span className="eyebrow">ACCESO</span><h2>Iniciar sesion</h2><p>La autenticacion ocurre exclusivamente en este shell.</p></div>
          <label><span>Usuario</span><input name="username" autoComplete="username" required maxLength={255} /></label>
          <label><span>Contrasena</span><input name="password" type="password" autoComplete="current-password" required maxLength={512} /></label>
          {loginError && <p className="form-error" role="alert">No fue posible validar las credenciales.</p>}
          <button type="submit">Entrar a Operaciones</button>
        </form>
      </main>
    )
  }

  return (
    <main className="shell">
      <header className="shell-header">
        <button className="brand" type="button" onClick={() => setActiveModuleId('resumen')}>
          <span>DUMA</span><strong>Operaciones</strong>
        </button>
        <div className="header-context"><span>Sesion</span><strong>{session.displayName}</strong></div>
        <button className="quiet-button" type="button" onClick={() => void logout()}>Cerrar sesion</button>
      </header>

      <div className="shell-layout">
        <aside className="sidebar">
          <nav aria-label="Modulos operativos">
            <button className={activeModuleId === 'resumen' ? 'active' : ''} type="button" onClick={() => setActiveModuleId('resumen')}><span>Resumen ICOS</span><small>Decision</small></button>
            {modules.map((module) => (
              <button className={activeModuleId === module.moduleId ? 'active' : ''} type="button" key={module.moduleId} onClick={() => setActiveModuleId(module.moduleId)}>
                <span>{module.displayName}</span><ModuleBadge stage={module.releaseStage} />
              </button>
            ))}
          </nav>
          <div className="clearance"><span>Clasificacion</span><strong>Academico privado</strong><small>El badge informa; no sustituye autorizacion.</small></div>
        </aside>

        <section className="workspace">
          <div className="workspace-controls">
            <details className="tenant-selector">
              <summary><span>Alcance</span><strong>{selectedTenants.length ? `${selectedTenants.length} tenants` : '7 tenants · Global'}</strong></summary>
              <div className="tenant-options">
                <button type="button" onClick={() => setSelectedTenants([])}>Todos los tenants</button>
                {tenants.map(([id, name]) => <label key={id}><input type="checkbox" checked={selectedTenants.includes(id)} onChange={(event) => setSelectedTenants((current) => event.target.checked ? [...current, id] : current.filter((value) => value !== id))} /><span>{name}</span></label>)}
              </div>
            </details>
            <label><span>Desde</span><input type="date" value={period.from} max={period.to} onChange={(event) => setPeriod((current) => ({ ...current, from: event.target.value }))} /></label>
            <label><span>Hasta</span><input type="date" value={period.to} min={period.from} onChange={(event) => setPeriod((current) => ({ ...current, to: event.target.value }))} /></label>
            <div className="timezone"><span>Zona horaria</span><strong>America/Mexico_City</strong></div>
          </div>

          {activeModuleId === 'resumen' && (
            <section className="overview">
              <div className="overview-heading">
                <div><span className="eyebrow">ICOS · RED COMPLETA</span><h1>La cobertura esta lista; el estado operativo depende de cada fuente.</h1></div>
                <div className="verdict neutral"><span>N1 · ESTADO DE INTEGRACION</span><strong>{modules.length}/4 modulos registrados</strong><p>Abra cada dominio para distinguir salud operativa, ausencia de datos y falta de cobertura.</p></div>
              </div>
              <div className="status-strip">
                <span>Periodo {period.from} a {period.to}</span>
                <span>{selectedTenants.length || 7} tenants en alcance</span>
                <span>Permisos preparados · sin reglas activas</span>
                <span>Actualizado {new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())}</span>
              </div>
              <div className="icos-grid">
                {pillars.map(([pillar, moduleId]) => {
                  const module = modules.find((candidate) => candidate.moduleId === moduleId)
                  return <button type="button" key={pillar} onClick={() => setActiveModuleId(moduleId)}><span>{pillar}</span><strong>{module?.displayName ?? 'Modulo no registrado'}</strong><small>{module ? 'Abrir evidencia y cobertura' : 'Integracion pendiente'}</small>{module && <ModuleStatusBadges module={module} />}</button>
                })}
              </div>
              <article className="decision-panel"><div><span>QUE HACER</span><h2>Priorice excepciones con datos disponibles.</h2></div><p>Los modulos muestran cada tenant por separado. Un estado sin tabla, sin filas o sin conexion conserva su causa y nunca se mezcla con un incumplimiento operativo.</p></article>
            </section>
          )}

          {activeModule && <ModuleHost module={activeModule} session={session} tenantIds={selectedTenants} period={period} onNavigate={setActiveModuleId} />}
        </section>
      </div>
    </main>
  )
}
