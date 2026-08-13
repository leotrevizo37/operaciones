import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiFetch, clearCsrf, ensureCsrf } from './api'
import { ModuleBadge, ModuleStatusBadges } from './ModuleBadge'
import { ModuleHost } from './ModuleHost'
import type { ModuleFreshness, ModuleRegistration, Session } from './types'

const tenants = [
  ['carlsjr', 'Carls Jr'],
  ['emerson', 'Emerson'],
  ['valledelencino', 'Valle del Encino'],
  ['mcdonalds', "McDonald's"],
  ['mcdonalds-cdp', "McDonald's CDP"],
  ['smartfit', 'SmartFit'],
  ['bafar-poc-gabinete', 'Bafar POC Gabinete'],
] as const

const moduleDefinitions = [
  ['lecturas', 'Lecturas', 'ICOS · TEMPERATURA', 'Continuidad y excepciones por sensor'],
  ['smartaudits', 'SmartAudits', 'ICOS · SMARTAUDITS', 'Cumplimiento, causas y revisión humana'],
  ['dispositivos', 'Dispositivos', 'ICOS · DISPOSITIVOS', 'Salud, riesgo y evidencia operacional'],
  ['experiencia-digital', 'Experiencia digital', 'ICOS · OPERACIONES', 'Disponibilidad, latencia y uso real'],
] as const

const freshnessPaths: Record<string, string> = {
  lecturas: '/api/readings/freshness',
  dispositivos: '/api/devices/freshness',
  smartaudits: '/api/smartaudits/freshness',
  'experiencia-digital': '/api/experience/freshness',
}

const dashboardPaths: Record<string, string> = {
  lecturas: '/api/readings',
  dispositivos: '/api/devices',
  smartaudits: '/api/smartaudits',
  'experiencia-digital': '/api/experience',
}

const moduleWeights: Record<string, number> = {
  lecturas: 0.5,
  dispositivos: 0.15,
  smartaudits: 0.25,
  'experiencia-digital': 0.1,
}

type FreshnessResponse = { tenants: ModuleFreshness[] }
type OverviewTenant = {
  tenantId: string
  tenantName: string
  coverageStatus: 'AVAILABLE' | 'NO_DATA' | 'NOT_SUPPORTED' | 'UNAVAILABLE'
  current: {
    sensorsObserved?: number
    healthySensors?: number
    devicesObserved?: number
    avgHealthScore?: number | null
    resultCount?: number
    complianceResults?: number
    users?: { sessionUserDays: number; completeInteractions: number }
    availability?: { observedServiceDays: number; avgUptimePercentage: number | null }
  }
  sensors?: Array<{ sensorId: string; locationName: string; deviceName: string; sensorName: string; observedIntervals?: number; lostIntervals?: number }>
  devices?: Array<{ deviceId: string; locationId: string | null; deviceName: string | null }>
  locations?: Array<{ locationId: string | null; locationName: string }>
}
type OverviewResponse = { tenants: OverviewTenant[] }
type FilterOption = { value: string; label: string }

function scoreFor(moduleId: string, rows: OverviewTenant[]) {
  const available = rows.filter((row) => row.coverageStatus === 'AVAILABLE')
  if (moduleId === 'lecturas') {
    const sensors = available.flatMap((row) => row.sensors ?? [])
    const observed = sensors.reduce((sum, sensor) => sum + (sensor.observedIntervals ?? 0), 0)
    const lost = sensors.reduce((sum, sensor) => sum + (sensor.lostIntervals ?? 0), 0)
    return observed ? (observed - lost) / observed * 100 : null
  }
  if (moduleId === 'dispositivos') {
    const observed = available.reduce((sum, row) => sum + (row.current.devicesObserved ?? 0), 0)
    return observed ? available.reduce((sum, row) => sum + (row.current.avgHealthScore ?? 0) * (row.current.devicesObserved ?? 0), 0) / observed : null
  }
  if (moduleId === 'smartaudits') {
    const results = available.reduce((sum, row) => sum + (row.current.resultCount ?? 0), 0)
    return results ? available.reduce((sum, row) => sum + (row.current.complianceResults ?? 0), 0) / results * 100 : null
  }
  const sessions = available.reduce((sum, row) => sum + (row.current.users?.sessionUserDays ?? 0), 0)
  const observed = available.reduce((sum, row) => sum + (row.current.availability?.observedServiceDays ?? 0), 0)
  const interaction = sessions ? available.reduce((sum, row) => sum + (row.current.users?.completeInteractions ?? 0), 0) / sessions * 100 : null
  const uptime = observed ? available.reduce((sum, row) => sum + (row.current.availability?.avgUptimePercentage ?? 0) * (row.current.availability?.observedServiceDays ?? 0), 0) / observed : null
  const components = [interaction, uptime].filter((value): value is number => value != null)
  return components.length ? components.reduce((sum, value) => sum + value, 0) / components.length : null
}

function scoreClass(value: number | null) {
  if (value == null) return 'critical'
  if (value >= 90) return 'healthy'
  if (value >= 75) return 'attention'
  return 'critical'
}

function weightedScore(scores: Record<string, number | null | undefined>) {
  const available = moduleDefinitions.filter(([moduleId]) => scores[moduleId] != null)
  const availableWeight = available.reduce((sum, [moduleId]) => sum + moduleWeights[moduleId], 0)
  return availableWeight ? available.reduce((sum, [moduleId]) => sum + scores[moduleId]! * moduleWeights[moduleId], 0) / availableWeight : null
}

function missingScoreLabel(row?: OverviewTenant) {
  if (!row || row.coverageStatus === 'NOT_SUPPORTED') return 'No habilitado'
  if (row.coverageStatus === 'UNAVAILABLE') return 'No disponible'
  if (row.coverageStatus === 'NO_DATA') return 'Sin datos'
  return 'Sin evidencia'
}

function mappedIngestionStatus(rows: ModuleFreshness[], connectionFailed: boolean) {
  const statuses = rows.map((row) => row.lastRunStatus?.trim().toUpperCase()).filter(Boolean)
  if (connectionFailed) return { tone: 'error', label: 'Error', detail: 'No fue posible consultar una o más fuentes.' }
  if (statuses.some((status) => ['FAILED', 'FAILURE', 'ERROR'].includes(status!))) return { tone: 'error', label: 'Error', detail: 'La última corrida reportada requiere atención.' }
  if (statuses.some((status) => ['RUNNING', 'STARTED', 'IN_PROGRESS', 'QUEUED'].includes(status!))) return { tone: 'running', label: 'Ejecutándose', detail: 'Hay una corrida de ingesta en ejecución.' }
  if (statuses.some((status) => ['SUCCESS', 'SUCCEEDED', 'COMPLETED', 'COMPLETE'].includes(status!))) return { tone: 'healthy', label: 'Exitoso', detail: 'La última corrida reportada terminó correctamente.' }
  return { tone: 'unknown', label: 'Sin estado', detail: 'No hay un estado de ingesta registrado para el alcance.' }
}

function isoDate(offsetDays: number) {
  const value = new Date()
  value.setUTCDate(value.getUTCDate() + offsetDays)
  return value.toISOString().slice(0, 10)
}

function initialPeriod() {
  return { from: isoDate(-30), to: isoDate(0) }
}

function ModuleIcon({ moduleId }: { moduleId: string }) {
  if (moduleId === 'resumen') return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></svg>
  if (moduleId === 'lecturas') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14.8V5.5a3 3 0 0 1 6 0v9.3a5 5 0 1 1-6 0Z" /><path d="M12 7v9" /><circle cx="12" cy="18" r="1.5" /></svg>
  if (moduleId === 'dispositivos') return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M8 2.5v2.5M12 2.5v2.5M16 2.5v2.5M8 19v2.5M12 19v2.5M16 19v2.5M1.5 9h2.5M1.5 15h2.5M20 9h2.5M20 15h2.5" /><path d="m7.5 12 2.2-2.2 3.1 4.1 3.7-4.4" /></svg>
  if (moduleId === 'smartaudits') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4.5h-2a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-13a2 2 0 0 0-2-2h-2" /><rect x="8" y="2.5" width="8" height="4" rx="1.5" /><path d="m8 14 2.5 2.5L16.5 10" /></svg>
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.4 2.5 3.7 5.5 3.7 9S14.4 18.5 12 21M12 3C9.6 5.5 8.3 8.5 8.3 12S9.6 18.5 12 21" /><path d="m5.5 16.2 2.2-2.2 2.1 1.7 3-3.4 2 1.6 3.7-4" /></svg>
}

function latestLoadedAt(rows: ModuleFreshness[]) {
  return rows.reduce<string | null>((latest, row) => !row.lastLoadedAt || latest && latest >= row.lastLoadedAt ? latest : row.lastLoadedAt, null)
}

function formatDay(value: string) {
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00`))
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [modules, setModules] = useState<ModuleRegistration[]>([])
  const [freshnessByModule, setFreshnessByModule] = useState<Record<string, ModuleFreshness[]>>({})
  const [overviewByModule, setOverviewByModule] = useState<Record<string, OverviewResponse>>({})
  const [moduleConnections, setModuleConnections] = useState<Record<string, boolean>>({})
  const [activeModuleId, setActiveModuleId] = useState('resumen')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [tenantSelectorOpen, setTenantSelectorOpen] = useState(false)
  const [selectedTenants, setSelectedTenants] = useState<string[]>([])
  const [draftTenants, setDraftTenants] = useState<string[]>([])
  const [filters, setFilters] = useState({ location: '', device: '', sensor: '' })
  const [draftFilters, setDraftFilters] = useState({ location: '', device: '', sensor: '' })
  const [period, setPeriod] = useState(initialPeriod)
  const [draftPeriod, setDraftPeriod] = useState(initialPeriod)
  const [authState, setAuthState] = useState<'loading' | 'anonymous' | 'authenticated'>('loading')
  const [loginError, setLoginError] = useState(false)
  const [summaryInsightOpen, setSummaryInsightOpen] = useState(true)
  const tenantSelectorRef = useRef<HTMLDetailsElement>(null)

  const loadFreshness = useCallback(async (registrations: ModuleRegistration[], tenantIds: string[]) => {
    const rows = await Promise.all(registrations.map(async (module) => {
      const path = freshnessPaths[module.moduleId]
      if (!path) return [module.moduleId, []] as const
      try {
        const token = await apiFetch<{ accessToken: string }>('/api/integration/token', {
          method: 'POST',
          body: JSON.stringify({ moduleId: module.moduleId }),
        })
        const query = new URLSearchParams()
        if (tenantIds.length) query.set('tenant', tenantIds.join(','))
        const response = await fetch(`${module.apiBaseUrl}${path}${query.size ? `?${query}` : ''}`, {
          headers: { Authorization: `Bearer ${token.accessToken}` },
        })
        if (!response.ok) throw new Error('freshness_unavailable')
        const payload = await response.json() as FreshnessResponse
        return [module.moduleId, payload.tenants] as const
      } catch {
        return [module.moduleId, []] as const
      }
    }))
    setFreshnessByModule(Object.fromEntries(rows))
  }, [])

  const loadOverview = useCallback(async (registrations: ModuleRegistration[], tenantIds: string[], selectedPeriod: { from: string; to: string }) => {
    const results = await Promise.all(registrations.map(async (module) => {
      const path = dashboardPaths[module.moduleId]
      if (!path) return [module.moduleId, null, false] as const
      try {
        const token = await apiFetch<{ accessToken: string }>('/api/integration/token', {
          method: 'POST',
          body: JSON.stringify({ moduleId: module.moduleId }),
        })
        const query = new URLSearchParams({ from: selectedPeriod.from, to: selectedPeriod.to })
        if (tenantIds.length) query.set('tenant', tenantIds.join(','))
        const response = await fetch(`${module.apiBaseUrl}${path}?${query}`, {
          headers: { Authorization: `Bearer ${token.accessToken}` },
        })
        if (!response.ok) throw new Error('overview_unavailable')
        const payload = await response.json() as OverviewResponse
        const connected = payload.tenants.some((tenant) => tenant.coverageStatus !== 'UNAVAILABLE')
        return [module.moduleId, payload, connected] as const
      } catch {
        return [module.moduleId, null, false] as const
      }
    }))
    setOverviewByModule(Object.fromEntries(results.filter((result): result is readonly [string, OverviewResponse, boolean] => result[1] != null).map(([moduleId, payload]) => [moduleId, payload])))
    setModuleConnections(Object.fromEntries(results.map(([moduleId, , connected]) => [moduleId, connected])))
  }, [])

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

  useEffect(() => {
    if (authState !== 'authenticated' || !modules.length) return
    void loadFreshness(modules, selectedTenants)
    void loadOverview(modules, selectedTenants, period)
  }, [authState, loadFreshness, loadOverview, modules, period, selectedTenants])

  useEffect(() => {
    function closeTenantSelector(event: MouseEvent) {
      if (!tenantSelectorRef.current?.contains(event.target as Node)) setTenantSelectorOpen(false)
    }
    document.addEventListener('click', closeTenantSelector)
    return () => document.removeEventListener('click', closeTenantSelector)
  }, [])

  const activeModule = useMemo(
    () => modules.find((module) => module.moduleId === activeModuleId),
    [activeModuleId, modules],
  )
  const scopedFreshnessByModule = useMemo(() => Object.fromEntries(
    Object.entries(freshnessByModule).map(([moduleId, rows]) => [
      moduleId,
      selectedTenants.length ? rows.filter((row) => selectedTenants.includes(row.tenantId)) : rows,
    ]),
  ), [freshnessByModule, selectedTenants])
  const activeFreshness = activeModule
    ? scopedFreshnessByModule[activeModule.moduleId] ?? []
    : Object.values(scopedFreshnessByModule).flat()
  const activeLoadedAt = latestLoadedAt(activeFreshness)
  const tenantLabel = selectedTenants.length
    ? tenants.filter(([id]) => selectedTenants.includes(id)).map(([, name]) => name).join(' + ')
    : 'Global'
  const draftTenantLabel = draftTenants.length
    ? tenants.filter(([id]) => draftTenants.includes(id)).map(([, name]) => name).join(', ')
    : 'Global'
  const moduleScores = useMemo(() => Object.fromEntries(moduleDefinitions.map(([moduleId]) => [
    moduleId,
    overviewByModule[moduleId] ? scoreFor(moduleId, overviewByModule[moduleId].tenants) : null,
  ])), [overviewByModule])
  const overallScore = weightedScore(moduleScores)
  const limitingModule = [...moduleDefinitions]
    .filter(([moduleId]) => moduleScores[moduleId] != null)
    .sort(([leftId], [rightId]) => moduleScores[leftId]! - moduleScores[rightId]!)[0]
  const tenantScores = useMemo(() => Object.fromEntries(tenants.map(([tenantId]) => [tenantId, Object.fromEntries(
    moduleDefinitions.map(([moduleId]) => {
      const row = overviewByModule[moduleId]?.tenants.find((tenant) => tenant.tenantId === tenantId)
      return [moduleId, row ? scoreFor(moduleId, [row]) : null]
    }),
  )])), [overviewByModule])
  const filterOptions = useMemo(() => {
    const result: { locations: FilterOption[]; devices: FilterOption[]; sensors: FilterOption[] } = { locations: [], devices: [], sensors: [] }
    const seen = { locations: new Set<string>(), devices: new Set<string>(), sensors: new Set<string>() }
    const readingLocationsByDevice = new Map<string, string>()
    overviewByModule.lecturas?.tenants.forEach((tenant) => tenant.sensors?.forEach((sensor) => {
      readingLocationsByDevice.set(`${tenant.tenantId}|${sensor.deviceName}`, sensor.locationName)
    }))
    if (activeModuleId !== 'dispositivos') overviewByModule.lecturas?.tenants.forEach((tenant) => tenant.sensors?.forEach((sensor) => {
      if (!seen.locations.has(sensor.locationName)) { seen.locations.add(sensor.locationName); result.locations.push({ value: sensor.locationName, label: `${tenant.tenantName} · ${sensor.locationName}` }) }
      if (!seen.devices.has(sensor.deviceName)) { seen.devices.add(sensor.deviceName); result.devices.push({ value: sensor.deviceName, label: `${tenant.tenantName} · ${sensor.deviceName}` }) }
      if (!seen.sensors.has(sensor.sensorId)) { seen.sensors.add(sensor.sensorId); result.sensors.push({ value: sensor.sensorId, label: `${sensor.sensorName} · ${sensor.deviceName}` }) }
    }))
    if (activeModuleId !== 'lecturas') overviewByModule.dispositivos?.tenants.forEach((tenant) => tenant.devices?.forEach((device) => {
      const name = device.deviceName ?? device.deviceId.slice(0, 8)
      if (!seen.devices.has(name)) { seen.devices.add(name); result.devices.push({ value: name, label: `${tenant.tenantName} · ${name}` }) }
      if (activeModuleId === 'dispositivos' && device.locationId && !seen.locations.has(device.locationId)) {
        seen.locations.add(device.locationId)
        result.locations.push({ value: device.locationId, label: `${tenant.tenantName} · ${readingLocationsByDevice.get(`${tenant.tenantId}|${name}`) ?? `ubicación ${device.locationId.slice(0, 8)}`}` })
      }
    }))
    return result
  }, [activeModuleId, overviewByModule])
  const showOperationalFilters = activeModuleId === 'resumen' || activeModuleId === 'lecturas' || activeModuleId === 'dispositivos'
  const activeConnectionFailed = activeModuleId === 'resumen'
    ? Object.values(moduleConnections).some((connected) => !connected)
    : moduleConnections[activeModuleId] === false
  const activeIngestionStatus = mappedIngestionStatus(activeFreshness, activeConnectionFailed)

  function applyFilters() {
    setSelectedTenants(draftTenants)
    setPeriod(draftPeriod)
    setFilters(draftFilters)
  }

  function clearFilters() {
    const nextPeriod = initialPeriod()
    setDraftTenants([])
    setSelectedTenants([])
    setDraftFilters({ location: '', device: '', sensor: '' })
    setFilters({ location: '', device: '', sensor: '' })
    setDraftPeriod(nextPeriod)
    setPeriod(nextPeriod)
  }

  function analyzeTenant(tenantId: string) {
    setDraftTenants([tenantId])
    setSelectedTenants([tenantId])
    setDraftFilters({ location: '', device: '', sensor: '' })
    setFilters({ location: '', device: '', sensor: '' })
  }

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
    setFreshnessByModule({})
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
        <div className="header-context"><span>Sesión</span><strong>{session.displayName}</strong></div>
        <button className="quiet-button" type="button" onClick={() => void logout()}>Cerrar sesión</button>
      </header>

      <div className={`shell-layout ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
          <button className="sidebar-toggle" type="button" aria-label={sidebarCollapsed ? 'Mostrar navegación completa' : 'Ocultar navegación'} title={sidebarCollapsed ? 'Mostrar navegación completa' : 'Mostrar sólo iconos'} onClick={() => setSidebarCollapsed((current) => !current)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d={sidebarCollapsed ? 'm9 5 7 7-7 7' : 'm15 5-7 7 7 7'} /></svg></button>
          <nav aria-label="Módulos operativos">
            <button className={activeModuleId === 'resumen' ? 'active' : ''} type="button" title="Resumen ICOS" onClick={() => setActiveModuleId('resumen')}><span className="nav-icon"><ModuleIcon moduleId="resumen" /></span><span>Resumen ICOS</span><small>Decisión global</small></button>
            {modules.map((module) => (
              <button className={activeModuleId === module.moduleId ? 'active' : ''} type="button" key={module.moduleId} title={module.displayName} onClick={() => setActiveModuleId(module.moduleId)}>
                <span className="nav-icon"><ModuleIcon moduleId={module.moduleId} /></span>
                <span>{module.displayName}</span><ModuleBadge stage={module.releaseStage} />
              </button>
            ))}
          </nav>
          <div className="clearance"><span>Clasificación</span><strong>Académico privado</strong><small>Acceso local y auditado.</small></div>
        </aside>

        <section className="workspace">
          <div className="workspace-toolbar">
            <div className="workspace-controls">
              <details className="tenant-selector" ref={tenantSelectorRef} open={tenantSelectorOpen}>
                <summary onClick={(event) => { event.preventDefault(); setTenantSelectorOpen((open) => !open) }}><span>Tenant</span><strong>{draftTenantLabel}</strong></summary>
                <div className="tenant-options">
                  <button type="button" onClick={() => { setDraftTenants([]); setDraftFilters({ location: '', device: '', sensor: '' }) }}>Global</button>
                  {tenants.map(([id, name]) => <label key={id}><input type="checkbox" checked={draftTenants.includes(id)} onChange={(event) => setDraftTenants((current) => event.target.checked ? [...current, id] : current.filter((value) => value !== id))} /><span>{name}</span></label>)}
                </div>
              </details>
              <label><span>Desde</span><input type="date" value={draftPeriod.from} max={draftPeriod.to} onChange={(event) => setDraftPeriod((current) => ({ ...current, from: event.target.value }))} /></label>
              <label><span>Hasta</span><input type="date" value={draftPeriod.to} min={draftPeriod.from} onChange={(event) => setDraftPeriod((current) => ({ ...current, to: event.target.value }))} /></label>
              {showOperationalFilters && <label><span>Sucursal</span><select value={draftFilters.location} disabled={!filterOptions.locations.length} onChange={(event) => setDraftFilters((current) => ({ ...current, location: event.target.value, device: '', sensor: '' }))}><option value="">Todas</option>{filterOptions.locations.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>}
              {showOperationalFilters && <label><span>Dispositivo</span><select value={draftFilters.device} disabled={!filterOptions.devices.length} onChange={(event) => setDraftFilters((current) => ({ ...current, device: event.target.value, sensor: '' }))}><option value="">Todos</option>{filterOptions.devices.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>}
              {(activeModuleId === 'resumen' || activeModuleId === 'lecturas') && <label><span>Sensor</span><select value={draftFilters.sensor} disabled={!filterOptions.sensors.length} onChange={(event) => setDraftFilters((current) => ({ ...current, sensor: event.target.value }))}><option value="">Todos</option>{filterOptions.sensors.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>}
              <button className="apply-filter" type="button" onClick={applyFilters}>Aplicar</button>
              <button className="clear-filter" type="button" onClick={clearFilters}>Limpiar</button>
              <div className="timezone"><span>Zona horaria</span><strong>America/Mexico_City</strong></div>
            </div>
            <div className="context-bar" aria-live="polite">
              <span className="status-light-tooltip" tabIndex={0} data-tooltip={activeIngestionStatus.detail} aria-label={`Estado de ingesta: ${activeIngestionStatus.label}. ${activeIngestionStatus.detail}`}><span className={`status-light ${activeIngestionStatus.tone}`} /></span>
              <span>{formatDay(period.from)} — {formatDay(period.to)}</span>
              <span className="tenant-context">{tenantLabel}</span>
              <span className="hierarchy-path">{activeModule?.displayName ?? 'Resumen ICOS'}</span>
              {activeConnectionFailed && <strong className="connection-warning">Base de datos no disponible</strong>}
              <span className="updated-at">{activeLoadedAt ? `Actualizado ${new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Mexico_City' }).format(new Date(activeLoadedAt))}` : 'Sin carga registrada'}</span>
            </div>
          </div>

          {activeModuleId === 'resumen' && (
            <section className="overview">
              <div className="summary-grid">
                <article className="card operational-card">
                  <div className="card-heading"><div><span>DECISIÓN GLOBAL</span><h1>Calificación de dominios operativos</h1></div><div className="summary-statuses"><span className={`state-pill ${scoreClass(overallScore)}`}>{overallScore == null ? 'Sin evidencia' : overallScore >= 90 ? 'En objetivo' : overallScore >= 75 ? 'Atención' : 'Crítico'}</span><span className={`ingestion-pill ${activeIngestionStatus.tone}`} title={activeIngestionStatus.detail}>Ingesta · {activeIngestionStatus.label}</span></div></div>
                  <div className="operational-body">
                    <div className="operational-verdict">
                      <span className={`verdict-status ${scoreClass(overallScore)}`}>Overall ponderado</span>
                      <div className="verdict-value"><strong>{overallScore == null ? '—' : `${overallScore.toFixed(1)}%`}</strong><span>calificación operativa del alcance</span></div>
                      <div className="verdict-scale"><i className={scoreClass(overallScore)} style={{ width: `${overallScore ?? 0}%` }} /></div>
                      <div className="verdict-thresholds"><span>Crítico</span><span>Atención</span><span>Objetivo</span></div>
                    </div>
                    <div className="score-decision">
                      <div className="score-components">
                        {moduleDefinitions.map(([moduleId, name]) => {
                          const score = moduleScores[moduleId]
                          return <div key={moduleId}><span>{name}</span><i><b className={scoreClass(score)} style={{ width: `${score ?? 0}%` }} /></i><strong>{score == null ? '—' : `${score.toFixed(1)}%`}</strong><small>{moduleWeights[moduleId] * 100}%</small></div>
                        })}
                      </div>
                    </div>
                  </div>
                </article>

                <div className="domain-grid">
                  {moduleDefinitions.map(([moduleId, fallbackName, domain, description]) => {
                    const module = modules.find((candidate) => candidate.moduleId === moduleId)
                    const freshness = scopedFreshnessByModule[moduleId] ?? []
                    const loadedAt = latestLoadedAt(freshness)
                    const score = moduleScores[moduleId]
                    const rows = overviewByModule[moduleId]?.tenants ?? []
                    const emptyLabel = !module || rows.every((row) => row.coverageStatus === 'NOT_SUPPORTED') ? 'No habilitado' : rows.some((row) => row.coverageStatus === 'UNAVAILABLE') ? 'No disponible' : rows.some((row) => row.coverageStatus === 'NO_DATA') ? 'Sin datos' : 'Sin evidencia'
                    return <article className="card domain-card" key={moduleId}>
                      <div className="card-heading"><div className="domain-heading"><span className="domain-icon"><ModuleIcon moduleId={moduleId} /></span><div><span>{domain}</span><h2>{module?.displayName ?? fallbackName}</h2></div></div><button type="button" disabled={!module} onClick={() => setActiveModuleId(moduleId)}>Abrir</button></div>
                      <strong className={`domain-value ${scoreClass(score)}`}>{score == null ? emptyLabel : `${score.toFixed(1)}%`}</strong>
                      <span className="domain-caption">{description}{loadedAt ? ` · actualizado ${new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Mexico_City' }).format(new Date(loadedAt))}` : ''}</span>
                      <div className="domain-badges">{module ? <ModuleStatusBadges module={module} connected={moduleConnections[moduleId]} /> : <span className="status-badge freshness-unknown">Integración pendiente</span>}</div>
                    </article>
                  })}
                </div>
              </div>

              {summaryInsightOpen && <aside className="summary-insight" role="status"><button className="summary-insight-close" type="button" aria-label="Cerrar insight" onClick={() => setSummaryInsightOpen(false)}>×</button><span>QUÉ HACER AHORA</span><strong>{limitingModule ? `${limitingModule[1]} limita la calificación global` : 'Revise los dominios sin evidencia'}</strong><p>{limitingModule ? `Es el dominio habilitado con menor calificación; priorícelo para elevar el resultado operativo del alcance.` : 'No hay evidencia suficiente para identificar el dominio que limita el resultado.'}</p>{limitingModule && <button type="button" onClick={() => setActiveModuleId(limitingModule[0])}>Abrir evidencia</button>}</aside>}
              {selectedTenants.length !== 1 && <article className="card tenant-comparison-panel">
                <div className="card-heading"><div><span>COMPARATIVO GLOBAL</span><h2>Alcance por tenant</h2></div><span>{selectedTenants.length || tenants.length} en alcance</span></div>
                <div className="tenant-comparison-grid">
                  {tenants.filter(([tenantId]) => !selectedTenants.length || selectedTenants.includes(tenantId)).map(([tenantId, name]) => {
                    const scores = tenantScores[tenantId]
                    const tenantOverall = weightedScore(scores)
                    return <div className="tenant-summary-card" key={tenantId}><div><strong>{name}</strong><span className={`state-pill ${scoreClass(tenantOverall)}`}>{tenantOverall == null ? 'Sin evidencia' : `${tenantOverall.toFixed(1)}%`}</span></div><dl>{moduleDefinitions.map(([moduleId, moduleName]) => { const row = overviewByModule[moduleId]?.tenants.find((tenant) => tenant.tenantId === tenantId); return <div key={moduleId}><dt>{moduleName}</dt><dd>{scores[moduleId] == null ? missingScoreLabel(row) : `${scores[moduleId].toFixed(1)}%`}</dd></div> })}</dl><button type="button" onClick={() => analyzeTenant(tenantId)}>Analizar tenant</button></div>
                  })}
                </div>
              </article>}
            </section>
          )}

          {activeModule && <ModuleHost module={activeModule} session={session} tenantIds={selectedTenants} period={period} filters={filters} freshness={scopedFreshnessByModule[activeModule.moduleId] ?? []} onNavigate={setActiveModuleId} />}
        </section>
      </div>
    </main>
  )
}
