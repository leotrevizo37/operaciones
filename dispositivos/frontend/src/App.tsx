import { useEffect, useMemo, useState } from 'react'
import { coverageLabel, delta, equipmentLabel, weightedMetric } from './metrics'
import type { DashboardResponse, Device, HostContext, Manifest, TenantResult } from './types'

const number = (value: number | null, digits = 0) => value == null
  ? '—'
  : new Intl.NumberFormat('es-MX', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value)

const baseline = (value: number | null, unit = 'pts') => value == null
  ? 'Sin baseline comparable'
  : `${value > 0 ? '+' : ''}${number(value, 1)} ${unit} vs. periodo anterior`

export default function App({ context }: { context: HostContext }) {
  const [manifest, setManifest] = useState<Manifest | null>(null)
  const [data, setData] = useState<DashboardResponse | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let active = true
    void (async () => {
      setState('loading')
      try {
        const token = await context.auth.getAccessToken('dispositivos')
        const query = new URLSearchParams({ from: context.period.from, to: context.period.to })
        if (context.tenantIds.length) query.set('tenant', context.tenantIds.join(','))
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined
        const [manifestResponse, dataResponse] = await Promise.all([
          fetch(`${context.apiBaseUrl}/api/module/manifest`),
          fetch(`${context.apiBaseUrl}/api/devices?${query}`, { headers }),
        ])
        if (!manifestResponse.ok || !dataResponse.ok) throw new Error('load_failed')
        const [nextManifest, nextData] = await Promise.all([
          manifestResponse.json() as Promise<Manifest>,
          dataResponse.json() as Promise<DashboardResponse>,
        ])
        if (active) {
          setManifest(nextManifest)
          setData(nextData)
          setState('ready')
        }
      } catch {
        if (active) setState('error')
      }
    })()
    return () => { active = false }
  }, [context])

  const available = useMemo(
    () => data?.tenants.filter((tenant) => tenant.coverageStatus === 'AVAILABLE') ?? [],
    [data],
  )
  const devices = useMemo(
    () => available.flatMap((tenant) => tenant.devices.map((device) => ({ ...device, tenantName: tenant.tenantName })))
      .sort((left, right) => (right.failureRiskScore ?? -1) - (left.failureRiskScore ?? -1)
        || (left.healthScore ?? 101) - (right.healthScore ?? 101)),
    [available],
  )
  const health = weightedMetric(available, 'avgHealthScore')
  const healthPrevious = weightedMetric(available, 'avgHealthScore', true)
  const observed = available.reduce((sum, tenant) => sum + tenant.current.devicesObserved, 0)
  const attention = available.reduce((sum, tenant) => sum + tenant.current.attentionDevices, 0)
  const critical = available.reduce((sum, tenant) => sum + tenant.current.criticalDevices, 0)
  const degrading = available.reduce((sum, tenant) => sum + tenant.current.degradingDevices, 0)

  if (state === 'loading') {
    return <section className="state"><strong>Consolidando salud de dispositivos</strong><span>Priorizando riesgo y evidencia por tenant.</span></section>
  }
  if (state === 'error' || !manifest || !data) {
    return <section className="state error"><strong>Dispositivos no está disponible</strong><span>La falla queda aislada dentro de este módulo.</span></section>
  }

  const verdict = critical
    ? `${critical} dispositivos están en estado crítico.`
    : attention
      ? `${attention} dispositivos requieren atención.`
      : available.length
        ? 'No se observan dispositivos fuera de operación normal.'
        : 'No existe evidencia suficiente para evaluar dispositivos.'

  return <main className="app">
    <header>
      <div>
        <span className="eyebrow">ICOS · DISPOSITIVOS</span>
        <h1>Inteligencia operacional</h1>
        <p>Riesgo primero; recomendación y evidencia después.</p>
      </div>
      <div className="badges">
        <span>Módulo · {manifest.releaseStage}</span>
        <span>Datos · {manifest.dataEnvironment} / {manifest.freshnessMode}</span>
        <span>Alcance · 7 tenants</span>
        <span>Clearance · {manifest.clearance}</span>
      </div>
    </header>

    <section className={`verdict ${critical ? 'critical' : attention ? 'warning' : available.length ? 'healthy' : 'neutral'}`}>
      <div><span>N1 · ESTADO OBSERVADO</span><strong>{verdict}</strong></div>
      <p>{critical
        ? 'Actúe sobre el mayor riesgo y valide confianza antes de intervenir.'
        : attention
          ? 'Compare tendencia, razón dominante y acción recomendada.'
          : 'Qué sigue: vigile degradación y cambios contra el periodo anterior.'}</p>
    </section>

    <section className="metrics">
      <article><span>Salud ponderada</span><strong>{number(health, 1)}</strong><p>{baseline(delta(health, healthPrevious))}</p></article>
      <article><span>Requieren atención</span><strong>{attention}</strong><p>de {observed} observados</p></article>
      <article><span>Críticos</span><strong>{critical}</strong><p>{degrading} con tendencia degradante</p></article>
      <article><span>Tenants con evidencia</span><strong>{available.length}/{data.tenants.length}</strong><p>Ausencia no se interpreta como cero</p></article>
    </section>

    <section className="coverage">
      <div className="section-heading"><div><span>RED</span><h2>Salud por tenant</h2></div><small>Peor condición primero</small></div>
      {[...data.tenants]
        .sort((left, right) => right.current.criticalDevices - left.current.criticalDevices
          || right.current.attentionDevices - left.current.attentionDevices)
        .map((tenant) => <TenantRow key={tenant.tenantId} tenant={tenant} />)}
    </section>

    <section className="families">
      <div className="section-heading"><div><span>ALCANCE</span><h2>Familias observadas</h2></div><small>Clasificación conservadora</small></div>
      <div className="family-grid">{(['CUARTO_FRIO', 'HVAC', 'BASCULA', 'SEGURIDAD', 'NO_CLASIFICADO'] as const).map((kind) => {
        const rows = devices.filter((device) => device.equipmentKind === kind)
        return <article key={kind}><span>{equipmentLabel(kind)}</span><strong>{rows.length}</strong><small>{rows.filter((item) => item.operationalState === 'CRITICAL').length} críticos</small></article>
      })}</div>
    </section>

    <section className="evidence">
      <div className="section-heading"><div><span>EVIDENCIA</span><h2>Dispositivos priorizados</h2></div><small>{devices.length} de hasta 100 por tenant</small></div>
      {devices.length
        ? <div className="table-wrap"><table><thead><tr><th>Tenant y dispositivo</th><th>Familia</th><th>Estado</th><th>Salud / riesgo</th><th>Tendencia</th><th>Razón y acción</th><th>Confianza</th></tr></thead><tbody>{devices.map((device) => <DeviceRow key={`${device.tenantName}-${device.deviceId}`} device={device} />)}</tbody></table></div>
        : <div className="empty"><strong>Sin evidencia detallada en el alcance disponible</strong><span>Los tenants sin soporte o sin datos permanecen diferenciados.</span></div>}
    </section>

    <section className="next">
      <div><span>N2 · RECOMENDACIÓN</span><h2>{critical ? 'Priorice el riesgo crítico con evidencia suficiente.' : attention ? 'Intervenga donde coincidan degradación y riesgo.' : 'Mantenga vigilancia por excepción.'}</h2></div>
      <p>Impacto esperado: dirigir mantenimiento donde el estado, la tendencia y la confianza sostienen la decisión.</p>
    </section>

    <footer><span>Generado {new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(data.generatedAt))}</span><span>{context.timezone}</span></footer>
  </main>
}

function TenantRow({ tenant }: { tenant: TenantResult }) {
  if (tenant.coverageStatus !== 'AVAILABLE') {
    return <article className="tenant unavailable"><div><strong>{tenant.tenantName}</strong><span>{coverageLabel(tenant.coverageStatus)}</span></div><p>{tenant.coverageStatus === 'NO_DATA' ? 'El fact existe sin dispositivos en el periodo.' : tenant.coverageStatus === 'NOT_SUPPORTED' ? 'El fact diario no existe para este tenant.' : 'La conexión o consulta no está disponible.'}</p></article>
  }
  const score = tenant.current.avgHealthScore
  return <article className="tenant">
    <div><strong>{tenant.tenantName}</strong><span>{tenant.missingSources.length ? 'Cobertura parcial' : 'Disponible'}</span></div>
    <div><span>Salud <b>{number(score, 1)}</b></span><span>Observados <b>{tenant.current.devicesObserved}</b></span><span>Atención <b>{tenant.current.attentionDevices}</b></span><span>Críticos <b>{tenant.current.criticalDevices}</b></span></div>
    <i><b style={{ width: `${Math.max(0, Math.min(score ?? 0, 100))}%` }} /></i>
  </article>
}

function DeviceRow({ device }: { device: Device & { tenantName: string } }) {
  const stateClass = device.operationalState === 'CRITICAL' ? 'critical-pill' : device.operationalState === 'NORMAL' ? 'healthy-pill' : 'warning-pill'
  return <tr>
    <td><strong>{device.tenantName}</strong><span>{device.deviceName || device.deviceId}</span></td>
    <td>{equipmentLabel(device.equipmentKind)}</td>
    <td><b className={stateClass}>{device.operationalState || 'Sin estado'}</b></td>
    <td><strong>{number(device.healthScore, 1)} / {number(device.failureRiskScore, 1)}</strong><span>salud / riesgo</span></td>
    <td>{device.trendDirection || '—'}</td>
    <td><strong>{device.dominantReasonCode || 'Sin razón dominante'}</strong><span>{device.recommendedAction || 'Sin acción prescrita'}</span></td>
    <td><strong>{number(device.confidenceScore, 2)}</strong><span>{device.scoringVersion || device.modelVersion || 'Sin versión'}</span></td>
  </tr>
}
