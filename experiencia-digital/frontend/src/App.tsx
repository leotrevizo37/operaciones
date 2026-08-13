import { useEffect, useMemo, useState } from 'react'
import { DataBadges } from './DataBadges'
import { coverageLabel, delta, interactionRate, weightedUptime } from './metrics'
import type { AvailabilityDaily, DashboardResponse, HostContext, Manifest, TenantResult, UserDaily } from './types'

type Props = { context: HostContext }

function formatNumber(value: number | null, digits = 0) {
  return value == null ? '—' : new Intl.NumberFormat('es-MX', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value)
}

function deltaText(value: number | null, unit: string) {
  if (value == null) return 'Sin baseline comparable'
  const sign = value > 0 ? '+' : ''
  return `${sign}${formatNumber(value, 1)}${unit} vs. periodo anterior`
}

function chartPoints(values: number[], maximum: number) {
  return values.map((value, index) => `${values.length === 1 ? 50 : index / Math.max(1, values.length - 1) * 100},${92 - Math.min(1, Math.max(0, value / Math.max(1, maximum))) * 78}`).join(' ')
}

export default function App({ context }: Props) {
  const [manifest, setManifest] = useState<Manifest | null>(null)
  const [data, setData] = useState<DashboardResponse | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let active = true
    async function load() {
      setState('loading')
      try {
        const token = await context.auth.getAccessToken('experiencia-digital')
        const query = new URLSearchParams({ from: context.period.from, to: context.period.to })
        if (context.tenantIds.length) query.set('tenant', context.tenantIds.join(','))
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined
        const [manifestResponse, dashboardResponse] = await Promise.all([
          fetch(`${context.apiBaseUrl}/api/module/manifest`),
          fetch(`${context.apiBaseUrl}/api/experience?${query}`, { headers }),
        ])
        if (!manifestResponse.ok || !dashboardResponse.ok) throw new Error('load_failed')
        const nextManifest = await manifestResponse.json() as Manifest
        const nextData = await dashboardResponse.json() as DashboardResponse
        if (!active) return
        setManifest(nextManifest)
        setData(nextData)
        setState('ready')
      } catch {
        if (active) setState('error')
      }
    }
    void load()
    return () => { active = false }
  }, [context])

  const available = useMemo(() => data?.tenants.filter((tenant) => tenant.coverageStatus === 'AVAILABLE') ?? [], [data])
  const currentInteraction = interactionRate(available)
  const previousInteraction = interactionRate(available, true)
  const currentUptime = weightedUptime(available)
  const previousUptime = weightedUptime(available, true)
  const downServices = available.reduce((sum, tenant) => sum + tenant.current.availability.currentDownServices, 0)
  const slowUserDays = available.reduce((sum, tenant) => sum + tenant.current.users.slowUserDays, 0)
  const worstTenant = [...available].sort((left, right) => (left.current.availability.avgUptimePercentage ?? 101) - (right.current.availability.avgUptimePercentage ?? 101))[0]
  const users = available.flatMap((tenant) => (tenant.users ?? []).map((user) => ({ ...user, tenantId: tenant.tenantId, tenantName: tenant.tenantName })))
  const userTimeline = available.flatMap((tenant) => (tenant.userTimeline ?? []).map((row) => ({ ...row, tenantId: tenant.tenantId })))
  const userDates = [...new Set(userTimeline.map((row) => row.metricDate))].sort()
  const timelineRows = new Map(userTimeline.map((row) => [`${row.tenantId}|${row.userId}|${row.metricDate}`, row]))
  const userDailyMap = new Map<string, UserDaily & { latencyTotal: number }>()
  available.flatMap((tenant) => tenant.userDaily ?? []).forEach((row) => {
    const current = userDailyMap.get(row.metricDate) ?? { ...row, usersEvaluated: 0, connectedUsers: 0, completeInteractions: 0, totalTimeConnected: 0, avgLatencyMs: null, maxP95LatencyMs: null, latencyTotal: 0 }
    current.usersEvaluated += row.usersEvaluated
    current.connectedUsers += row.connectedUsers
    current.completeInteractions += row.completeInteractions
    current.totalTimeConnected += row.totalTimeConnected
    current.latencyTotal += (row.avgLatencyMs ?? 0) * row.connectedUsers
    current.avgLatencyMs = current.connectedUsers ? current.latencyTotal / current.connectedUsers : null
    current.maxP95LatencyMs = Math.max(current.maxP95LatencyMs ?? 0, row.maxP95LatencyMs ?? 0) || null
    userDailyMap.set(row.metricDate, current)
  })
  const userDaily = [...userDailyMap.values()].sort((left, right) => left.metricDate.localeCompare(right.metricDate))
  const endpoints = available.flatMap((tenant) => (tenant.endpoints ?? []).map((endpoint) => ({ ...endpoint, tenantName: tenant.tenantName })))
  const availabilityRows = available.flatMap((tenant) => (tenant.availabilityDaily ?? []).map((row) => ({ ...row, tenantId: tenant.tenantId })))
  const sidonRows = availabilityRows.some((row) => row.url.includes('sidon.mx')) ? availabilityRows.filter((row) => row.url.includes('sidon.mx')) : availabilityRows
  const availabilityByDate = new Map<string, AvailabilityDaily & { count: number; uptimeTotal: number; latencyTotal: number; p95: number }>()
  sidonRows.forEach((row) => {
    const current = availabilityByDate.get(row.metricDate) ?? { ...row, count: 0, uptimeTotal: 0, latencyTotal: 0, p95: 0 }
    current.count += 1
    current.uptimeTotal += row.uptimePercentage ?? 0
    current.latencyTotal += row.avgLatencySeconds ?? 0
    current.p95 = Math.max(current.p95, row.latency95thPercentileSeconds ?? 0)
    current.uptimePercentage = current.uptimeTotal / current.count
    current.avgLatencySeconds = current.latencyTotal / current.count
    current.latency95thPercentileSeconds = current.p95
    availabilityByDate.set(row.metricDate, current)
  })
  const availabilityDaily = [...availabilityByDate.values()].sort((left, right) => left.metricDate.localeCompare(right.metricDate))
  const maxUserTime = Math.max(1, ...users.map((user) => user.timeConnectedSeconds))
  const maxUserLatency = Math.max(1, ...userDaily.flatMap((row) => [row.avgLatencyMs ?? 0, row.maxP95LatencyMs ?? 0]))
  const maxAvailabilityLatency = Math.max(1, ...availabilityDaily.flatMap((row) => [row.avgLatencySeconds ?? 0, row.latency95thPercentileSeconds ?? 0]))

  if (state === 'loading') return <section className="experience-state"><strong>Consultando experiencia digital</strong><span>Separando cobertura y estado por tenant.</span></section>
  if (state === 'error' || !manifest || !data) return <section className="experience-state error"><strong>No fue posible consultar el modulo</strong><span>La falla no afecta a los demas microfrontends.</span></section>

  const verdictClass = downServices ? 'critical' : slowUserDays ? 'warning' : available.length ? 'healthy' : 'neutral'
  const verdict = downServices
    ? `${downServices} servicios estan abajo; la experiencia requiere atencion inmediata.`
    : slowUserDays
      ? `La plataforma responde, pero ${slowUserDays} jornadas de usuario fueron lentas.`
      : available.length
        ? 'Los servicios disponibles no muestran interrupciones actuales.'
        : 'No existe evidencia suficiente para emitir un veredicto operativo.'

  return (
    <main className="experience-app">
      <div className="page-heading"><header className="module-heading">
        <div><span className="eyebrow">ICOS · OPERACIONES</span><h1>Experiencia digital</h1><p>Uso real explicado por disponibilidad, latencia y timeouts.</p></div>
        <DataBadges manifest={manifest} />
      </header>

      <section className={`operational-verdict ${verdictClass}`}>
        <div><span>N1 · VEREDICTO OBSERVADO</span><strong>{verdict}</strong></div>
        <p>{worstTenant ? `${worstTenant.tenantName} tiene el uptime mas bajo del alcance. Revise su evidencia antes de atribuir la causa a los usuarios.` : 'Configure o habilite al menos una fuente para comenzar el diagnostico.'}</p>
      </section></div>

      <section className="metric-grid">
        <article><span>Interacciones completas</span><strong>{formatNumber(currentInteraction, 1)}%</strong><p>{deltaText(delta(currentInteraction, previousInteraction), ' pp')}</p><i className={currentInteraction != null && currentInteraction < 80 ? 'warning' : 'healthy'}>{currentInteraction == null ? 'Sin evidencia' : currentInteraction < 80 ? 'Requiere atencion' : 'En rango observado'}</i></article>
        <article><span>Uptime ponderado</span><strong>{formatNumber(currentUptime, 2)}%</strong><p>{deltaText(delta(currentUptime, previousUptime), ' pp')}</p><i className={downServices ? 'critical' : currentUptime == null ? 'neutral' : 'healthy'}>{downServices ? `${downServices} abajo ahora` : currentUptime == null ? 'Sin evidencia' : 'Sin caidas actuales'}</i></article>
        <article><span>Jornadas lentas</span><strong>{slowUserDays.toLocaleString('es-MX')}</strong><p>AvgLatency ≥ 2,000 ms · periodo actual</p><i className={slowUserDays ? 'warning' : 'healthy'}>{slowUserDays ? 'Investigar latencia' : 'Sin jornadas lentas'}</i></article>
        <article><span>Cobertura consultada</span><strong>{available.length}/{data.tenants.length}</strong><p>Tenants con filas en {data.from} a {data.to}</p><i className={available.length === data.tenants.length ? 'healthy' : 'neutral'}>{available.length === data.tenants.length ? 'Cobertura completa' : 'Cobertura parcial'}</i></article>
      </section>

      {context.tenantIds.length !== 1 && <section className="tenant-comparison">
        <div className="section-heading"><div><span>DIAGNOSTICO</span><h2>Uso y disponibilidad por tenant</h2></div><small>Ordenado por peor uptime disponible</small></div>
        <div className="tenant-list">
          {[...data.tenants].sort((left, right) => {
            if (left.coverageStatus !== 'AVAILABLE') return 1
            if (right.coverageStatus !== 'AVAILABLE') return -1
            return (left.current.availability.avgUptimePercentage ?? 101) - (right.current.availability.avgUptimePercentage ?? 101)
          }).map((tenant) => <TenantRow tenant={tenant} key={tenant.tenantId} />)}
        </div>
      </section>}

      <section className="detail-card heatmap-panel">
        <div className="section-heading"><div><span>USO A TRAVES DEL TIEMPO</span><h2>Tiempo conectado diario por UserId</h2></div><small>{userDates.length} dias · {users.length} usuarios</small></div>
        {users.length && userDates.length ? <><div className="heatmap-legend"><span><i className="none" />0 min</span><span><i className="medium" />60 min</span><span><i className="high" />120+ min</span></div><div className="timeline-scroll"><div className="timeline-matrix" style={{ minWidth: `${Math.max(760, userDates.length * 25 + 210)}px` }}><div className="timeline-row timeline-header" style={{ gridTemplateColumns: `200px repeat(${userDates.length}, minmax(20px, 1fr))` }}><strong>UserId</strong>{userDates.map((date, index) => <span key={date}>{index % Math.max(1, Math.ceil(userDates.length / 10)) === 0 ? date.slice(5) : ''}</span>)}</div>{users.map((user) => <div className="timeline-row" key={`${user.tenantId}-${user.userId}`} style={{ gridTemplateColumns: `200px repeat(${userDates.length}, minmax(20px, 1fr))` }}><div className="timeline-label"><strong>{user.displayName}</strong><span>{user.tenantName} · {user.userId}</span></div>{userDates.map((date) => { const row = timelineRows.get(`${user.tenantId}|${user.userId}|${date}`); const intensity = row && row.timeConnectedSeconds > 0 ? .08 + Math.min(row.timeConnectedSeconds, 7200) / 7200 * .86 : .03; return <span key={date} className="heatmap-cell" style={{ backgroundColor: `rgba(20,122,104,${intensity})` }} title={row ? `${date}: ${(row.timeConnectedSeconds / 60).toFixed(1)} min · ${row.avgLatencyMs ? `${(row.avgLatencyMs / 1000).toFixed(2)} s por click` : 'sin latencia'}` : `${date}: sin registro`} /> })}</div>)}</div></div></> : <div className="detail-empty">Sin historia por usuario en el periodo.</div>}
      </section>

      <div className="detail-grid">
        <section className="detail-card chart-card"><div className="section-heading"><div><span>PERMANENCIA</span><h2>Tiempo conectado por usuario</h2></div><small>Acumulado del periodo</small></div><div className="horizontal-bars">{users.map((user) => <div key={`${user.tenantId}-${user.userId}`}><label><strong>{user.displayName}</strong><span>{user.tenantName} · {user.position ?? 'Usuario'}</span></label><div><i style={{ width: `${Math.max(1, user.timeConnectedSeconds / maxUserTime * 100)}%` }} /></div><b>{(user.timeConnectedSeconds / 60).toFixed(0)} min</b></div>)}</div></section>
        <section className="detail-card chart-card"><div className="section-heading"><div><span>FRICCION</span><h2>Espera diaria por click</h2></div><small>Promedio contra P95</small></div><div className="chart-legend"><span className="teal">Promedio</span><span className="orange">P95 maximo</span></div><LineChart values={[userDaily.map((row) => row.avgLatencyMs ?? 0), userDaily.map((row) => row.maxP95LatencyMs ?? 0)]} maximum={maxUserLatency} labels={userDaily.map((row) => row.metricDate)} classes={['teal-line', 'orange-line']} /></section>
      </div>

      <section className="detail-card table-panel"><div className="section-heading"><div><span>DETALLE</span><h2>Experiencia individual</h2></div><small>{users.length} usuarios</small></div><div className="table-scroll"><table><thead><tr><th>Tenant</th><th>Usuario</th><th>Dias evaluados</th><th>Tiempo total</th><th>Sesion promedio</th><th>Espera media</th><th>P95</th><th>Interacciones</th><th>Ultima actividad</th></tr></thead><tbody>{users.map((user) => <tr key={`${user.tenantId}-${user.userId}`}><td><strong>{user.tenantName}</strong></td><td><strong>{user.displayName}</strong><span>{user.userId}</span></td><td>{user.daysEvaluated}</td><td>{(user.timeConnectedSeconds / 60).toFixed(0)} min</td><td>{user.avgSessionSeconds ? `${(user.avgSessionSeconds / 60).toFixed(1)} min` : '—'}</td><td>{user.avgLatencyMs ? `${(user.avgLatencyMs / 1000).toFixed(2)} s` : '—'}</td><td>{user.p95LatencyMs ? `${(user.p95LatencyMs / 1000).toFixed(2)} s` : '—'}</td><td>{user.completeInteractions}</td><td>{user.lastActivityDate ?? 'Sin actividad'}</td></tr>)}</tbody></table></div></section>

      <section className="availability-section"><div className="section-heading"><div><span>DISPONIBILIDAD</span><h2>Uptime, latencia y timeouts por servicio</h2></div><small>{endpoints.length} servicios observados</small></div><div className="endpoint-grid">{endpoints.map((endpoint) => <article key={`${endpoint.tenantName}-${endpoint.url}`}><span>{endpoint.tenantName} · {endpoint.url.includes('sidon.mx') ? 'Plataforma SIDON' : endpoint.url}</span><strong>{formatNumber(endpoint.uptimePercentage, 2)}%</strong><div><span>{formatNumber(endpoint.avgLatencySeconds, 3)} s media</span><span>{endpoint.timeoutDays} timeouts</span></div></article>)}</div></section>

      <div className="detail-grid">
        <section className="detail-card chart-card"><div className="section-heading"><div><span>PLATAFORMA</span><h2>Uptime global por dia</h2></div><small>Escala fija 0–100%</small></div><LineChart values={[availabilityDaily.map((row) => row.uptimePercentage ?? 0)]} maximum={100} labels={availabilityDaily.map((row) => row.metricDate)} classes={['green-line']} area /></section>
        <section className="detail-card chart-card"><div className="section-heading"><div><span>RESPUESTA</span><h2>Promedio contra P95</h2></div><small>Segundos</small></div><div className="chart-legend"><span className="teal">Promedio</span><span className="orange">P95</span></div><LineChart values={[availabilityDaily.map((row) => row.avgLatencySeconds ?? 0), availabilityDaily.map((row) => row.latency95thPercentileSeconds ?? 0)]} maximum={maxAvailabilityLatency} labels={availabilityDaily.map((row) => row.metricDate)} classes={['teal-line', 'orange-line']} /></section>
      </div>

      <section className="detail-card table-panel"><div className="section-heading"><div><span>SERVICIOS OBSERVADOS</span><h2>Detalle independiente por URL</h2></div><small>No mezcla servicios ni tenants</small></div><div className="table-scroll"><table><thead><tr><th>Tenant</th><th>Servicio</th><th>Uptime</th><th>Latencia media</th><th>P95</th><th>Dias arriba</th><th>Timeouts</th><th>Estado actual</th></tr></thead><tbody>{endpoints.map((endpoint) => <tr key={`${endpoint.tenantName}-${endpoint.url}`}><td><strong>{endpoint.tenantName}</strong></td><td><strong>{endpoint.url.includes('sidon.mx') ? 'Plataforma SIDON' : endpoint.url}</strong><span>{endpoint.url}</span></td><td>{formatNumber(endpoint.uptimePercentage, 2)}%</td><td>{formatNumber(endpoint.avgLatencySeconds, 3)} s</td><td>{formatNumber(endpoint.latency95thPercentileSeconds, 3)} s</td><td>{endpoint.upDays}/{endpoint.observedDays}</td><td>{endpoint.timeoutDays}</td><td><b className={`state-pill ${endpoint.currentIsUp && !endpoint.currentTimeouts ? 'healthy' : endpoint.currentIsUp ? 'attention' : 'critical'}`}>{endpoint.currentIsUp ? endpoint.currentTimeouts ? 'Con timeout' : 'Arriba' : 'Abajo'}</b></td></tr>)}</tbody></table></div></section>

      <section className="next-step"><div><span>N2 · RECOMENDACION</span><h2>{downServices ? 'Atienda primero los servicios abajo.' : slowUserDays ? 'Cruce latencia con las jornadas afectadas.' : 'Mantenga vigilancia sobre cobertura y frescura.'}</h2></div><p>Que sigue: confirme el ultimo corte por tenant y observe si el cambio se concentra en uso, respuesta o disponibilidad.</p></section>
      <footer><span>Generado {new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(data.generatedAt))}</span><span>Zona horaria · {context.timezone}</span></footer>
    </main>
  )
}

function LineChart({ values, maximum, labels, classes, area = false }: { values: number[][]; maximum: number; labels: string[]; classes: string[]; area?: boolean }) {
  return <div className="large-line-chart"><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img">{[20, 40, 60, 80].map((y) => <line key={y} x1="0" y1={y} x2="100" y2={y} />)}{area && values[0]?.length ? <polygon className="chart-area" points={`0,92 ${chartPoints(values[0], maximum)} 100,92`} /> : null}{values.map((series, index) => <polyline key={classes[index]} className={classes[index]} points={chartPoints(series, maximum)} />)}</svg><div className="chart-labels">{labels.map((label, index) => index % Math.max(1, Math.ceil(labels.length / 6)) === 0 ? <span key={label}>{label.slice(5)}</span> : null)}</div></div>
}

function TenantRow({ tenant }: { tenant: TenantResult }) {
  if (tenant.coverageStatus !== 'AVAILABLE') {
    return <article className="tenant-row unavailable"><div><strong>{tenant.tenantName}</strong><span>{coverageLabel(tenant.coverageStatus)}</span></div><p>{tenant.coverageStatus === 'NO_DATA' ? 'Las tablas existen, pero no hay filas en el periodo.' : tenant.coverageStatus === 'NOT_SUPPORTED' ? `Fuentes ausentes: ${tenant.missingSources.join(', ')}` : 'La conexion o consulta no estuvo disponible.'}</p></article>
  }
  const uptime = tenant.current.availability.avgUptimePercentage
  const rate = interactionRate([tenant])
  return <article className="tenant-row"><div><strong>{tenant.tenantName}</strong><span>{coverageLabel(tenant.coverageStatus)}</span></div><div className="tenant-metrics"><span>Interaccion <b>{formatNumber(rate, 1)}%</b></span><span>Uptime <b>{formatNumber(uptime, 2)}%</b></span><span>P95 web <b>{formatNumber(tenant.current.availability.maxP95LatencySeconds, 3)} s</b></span><span>Timeouts <b>{tenant.current.availability.timeoutDays}</b></span></div><div className="uptime-track" aria-label={`Uptime ${formatNumber(uptime, 2)}%`}><i style={{ width: `${Math.max(0, Math.min(100, uptime ?? 0))}%` }} /></div>{tenant.missingSources.length > 0 && <small>Cobertura parcial: falta {tenant.missingSources.join(', ')}</small>}</article>
}
