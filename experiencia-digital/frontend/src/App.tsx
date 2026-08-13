import { useEffect, useMemo, useState } from 'react'
import { DataBadges } from './DataBadges'
import { coverageLabel, delta, interactionRate, weightedUptime } from './metrics'
import type { DashboardResponse, HostContext, Manifest, TenantResult } from './types'

type Props = { context: HostContext }

function formatNumber(value: number | null, digits = 0) {
  return value == null ? '—' : new Intl.NumberFormat('es-MX', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value)
}

function deltaText(value: number | null, unit: string) {
  if (value == null) return 'Sin baseline comparable'
  const sign = value > 0 ? '+' : ''
  return `${sign}${formatNumber(value, 1)}${unit} vs. periodo anterior`
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
      <header className="module-heading">
        <div><span className="eyebrow">ICOS · OPERACIONES</span><h1>Experiencia digital</h1><p>Uso real explicado por disponibilidad, latencia y timeouts.</p></div>
        <DataBadges manifest={manifest} />
      </header>

      <section className={`operational-verdict ${verdictClass}`}>
        <div><span>N1 · VEREDICTO OBSERVADO</span><strong>{verdict}</strong></div>
        <p>{worstTenant ? `${worstTenant.tenantName} tiene el uptime mas bajo del alcance. Revise su evidencia antes de atribuir la causa a los usuarios.` : 'Configure o habilite al menos una fuente para comenzar el diagnostico.'}</p>
      </section>

      <section className="metric-grid">
        <article><span>Interacciones completas</span><strong>{formatNumber(currentInteraction, 1)}%</strong><p>{deltaText(delta(currentInteraction, previousInteraction), ' pp')}</p><i className={currentInteraction != null && currentInteraction < 80 ? 'warning' : 'healthy'}>{currentInteraction == null ? 'Sin evidencia' : currentInteraction < 80 ? 'Requiere atencion' : 'En rango observado'}</i></article>
        <article><span>Uptime ponderado</span><strong>{formatNumber(currentUptime, 2)}%</strong><p>{deltaText(delta(currentUptime, previousUptime), ' pp')}</p><i className={downServices ? 'critical' : currentUptime == null ? 'neutral' : 'healthy'}>{downServices ? `${downServices} abajo ahora` : currentUptime == null ? 'Sin evidencia' : 'Sin caidas actuales'}</i></article>
        <article><span>Jornadas lentas</span><strong>{slowUserDays.toLocaleString('es-MX')}</strong><p>AvgLatency ≥ 2,000 ms · periodo actual</p><i className={slowUserDays ? 'warning' : 'healthy'}>{slowUserDays ? 'Investigar latencia' : 'Sin jornadas lentas'}</i></article>
        <article><span>Cobertura consultada</span><strong>{available.length}/{data.tenants.length}</strong><p>Tenants con filas en {data.from} a {data.to}</p><i className={available.length === data.tenants.length ? 'healthy' : 'neutral'}>{available.length === data.tenants.length ? 'Cobertura completa' : 'Cobertura parcial'}</i></article>
      </section>

      <section className="tenant-comparison">
        <div className="section-heading"><div><span>DIAGNOSTICO</span><h2>Uso y disponibilidad por tenant</h2></div><small>Ordenado por peor uptime disponible</small></div>
        <div className="tenant-list">
          {[...data.tenants].sort((left, right) => {
            if (left.coverageStatus !== 'AVAILABLE') return 1
            if (right.coverageStatus !== 'AVAILABLE') return -1
            return (left.current.availability.avgUptimePercentage ?? 101) - (right.current.availability.avgUptimePercentage ?? 101)
          }).map((tenant) => <TenantRow tenant={tenant} key={tenant.tenantId} />)}
        </div>
      </section>

      <section className="next-step"><div><span>N2 · RECOMENDACION</span><h2>{downServices ? 'Atienda primero los servicios abajo.' : slowUserDays ? 'Cruce latencia con las jornadas afectadas.' : 'Mantenga vigilancia sobre cobertura y frescura.'}</h2></div><p>Que sigue: confirme el ultimo corte por tenant y observe si el cambio se concentra en uso, respuesta o disponibilidad.</p></section>
      <footer><span>Generado {new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(data.generatedAt))}</span><span>Zona horaria · {context.timezone}</span></footer>
    </main>
  )
}

function TenantRow({ tenant }: { tenant: TenantResult }) {
  if (tenant.coverageStatus !== 'AVAILABLE') {
    return <article className="tenant-row unavailable"><div><strong>{tenant.tenantName}</strong><span>{coverageLabel(tenant.coverageStatus)}</span></div><p>{tenant.coverageStatus === 'NO_DATA' ? 'Las tablas existen, pero no hay filas en el periodo.' : tenant.coverageStatus === 'NOT_SUPPORTED' ? `Fuentes ausentes: ${tenant.missingSources.join(', ')}` : 'La conexion o consulta no estuvo disponible.'}</p></article>
  }
  const uptime = tenant.current.availability.avgUptimePercentage
  const rate = interactionRate([tenant])
  return <article className="tenant-row"><div><strong>{tenant.tenantName}</strong><span>{coverageLabel(tenant.coverageStatus)}</span></div><div className="tenant-metrics"><span>Interaccion <b>{formatNumber(rate, 1)}%</b></span><span>Uptime <b>{formatNumber(uptime, 2)}%</b></span><span>P95 web <b>{formatNumber(tenant.current.availability.maxP95LatencySeconds, 3)} s</b></span><span>Timeouts <b>{tenant.current.availability.timeoutDays}</b></span></div><div className="uptime-track" aria-label={`Uptime ${formatNumber(uptime, 2)}%`}><i style={{ width: `${Math.max(0, Math.min(100, uptime ?? 0))}%` }} /></div>{tenant.missingSources.length > 0 && <small>Cobertura parcial: falta {tenant.missingSources.join(', ')}</small>}</article>
}
