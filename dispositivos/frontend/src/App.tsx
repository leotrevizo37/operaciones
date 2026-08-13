import { Fragment, useEffect, useMemo, useState } from 'react'
import { coverageLabel, delta, equipmentLabel, weightedMetric } from './metrics'
import type { DashboardResponse, Device, DeviceDetailResponse, DeviceHour, HostContext, Manifest, TenantResult } from './types'

const number = (value: number | null, digits = 0) => value == null
  ? '—'
  : new Intl.NumberFormat('es-MX', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value)

const baseline = (value: number | null, unit = 'pts') => value == null
  ? 'Sin baseline comparable'
  : `${value > 0 ? '+' : ''}${number(value, 1)} ${unit} vs. periodo anterior`

const chartPoints = (values: number[], maximum = 100) => values.map((value, index) => `${values.length === 1 ? 50 : index / Math.max(1, values.length - 1) * 100},${92 - Math.min(1, Math.max(0, value / Math.max(1, maximum))) * 78}`).join(' ')
const stateLabels: Record<string, string> = { NORMAL: 'Normal', WATCH: 'Vigilancia', OUT_OF_RANGE: 'Fuera de rango', SENSOR_FAULT_SUSPECTED: 'Posible falla de sensor', DEGRADED: 'Degradado', EXPECTED_VALUE_DRIFT: 'Deriva esperada', CRITICAL: 'Critico', DATA_UNRELIABLE: 'Datos no confiables' }
const reasonLabels: Record<string, string> = { INSUFFICIENT_COVERAGE: 'Cobertura insuficiente', EVENT_PRESSURE: 'Presion de eventos', HIGH_FAILURE_RISK: 'Riesgo de falla', SENSOR_RELIABILITY: 'Confiabilidad de sensores', EXPECTED_VALUE_DRIFT: 'Deriva contra valores esperados', OUT_OF_RANGE: 'Lecturas fuera de rango', PEER_DEVIATION: 'Desviacion contra pares', BEHAVIOR_CHANGE: 'Cambio de comportamiento', RECURRING_EVENTS: 'Eventos recurrentes', NORMAL_PATTERN: 'Patron normal' }

export default function App({ context }: { context: HostContext }) {
  const [manifest, setManifest] = useState<Manifest | null>(null)
  const [data, setData] = useState<DashboardResponse | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [accessToken, setAccessToken] = useState('')
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [detail, setDetail] = useState<{ key: string; data: DeviceDetailResponse | null; loading: boolean; error: string }>({ key: '', data: null, loading: false, error: '' })

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
          setAccessToken(token)
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
    () => available.flatMap((tenant) => tenant.devices.map((device) => ({ ...device, tenantId: tenant.tenantId, tenantName: tenant.tenantName })))
      .filter((device) => (!context.filters?.location || device.locationId === context.filters.location) && (!context.filters?.device || (device.deviceName ?? device.deviceId.slice(0, 8)) === context.filters.device))
      .sort((left, right) => (right.failureRiskScore ?? -1) - (left.failureRiskScore ?? -1)
        || (left.healthScore ?? 101) - (right.healthScore ?? 101)),
    [available, context.filters],
  )
  const health = weightedMetric(available, 'avgHealthScore')
  const healthPrevious = weightedMetric(available, 'avgHealthScore', true)
  const observed = available.reduce((sum, tenant) => sum + tenant.current.devicesObserved, 0)
  const attention = available.reduce((sum, tenant) => sum + tenant.current.attentionDevices, 0)
  const critical = available.reduce((sum, tenant) => sum + tenant.current.criticalDevices, 0)
  const degrading = available.reduce((sum, tenant) => sum + tenant.current.degradingDevices, 0)
  const visibleDeviceKeys = new Set(devices.map((device) => `${device.tenantId}|${device.deviceId}|${device.locationId}|${device.subLocationId}`))
  const daily = available.flatMap((tenant) => (tenant.daily ?? []).map((row) => ({ ...row, tenantId: tenant.tenantId, tenantName: tenant.tenantName }))).filter((row) => visibleDeviceKeys.has(`${row.tenantId}|${row.deviceId}|${row.locationId}|${row.subLocationId}`))
  const hourly = available.flatMap((tenant) => (tenant.hourly ?? []).map((row) => ({ ...row, tenantId: tenant.tenantId, tenantName: tenant.tenantName }))).filter((row) => visibleDeviceKeys.has(`${row.tenantId}|${row.deviceId}|${row.locationId}|${row.subLocationId}`))
  const deviceDates = [...new Set(daily.map((row) => row.localDate))].sort()
  const deviceHours = [...new Set(hourly.map((row) => row.localTimeSpan))].sort()
  const dailyRows = new Map(daily.map((row) => [`${row.tenantId}|${row.deviceId}|${row.locationId}|${row.subLocationId}|${row.localDate}`, row]))
  const hourlyRows = new Map(hourly.map((row) => [`${row.tenantId}|${row.deviceId}|${row.locationId}|${row.subLocationId}|${row.localTimeSpan}`, row]))
  const historyMap = new Map<string, { localDate: string; count: number; health: number; seven: number; thirty: number; risk: number }>()
  daily.forEach((row) => { const current = historyMap.get(row.localDate) ?? { localDate: row.localDate, count: 0, health: 0, seven: 0, thirty: 0, risk: 0 }; current.count += 1; current.health += row.healthScore ?? 0; current.seven += row.sevenDayHealthScore ?? 0; current.thirty += row.thirtyDayHealthScore ?? 0; current.risk += (row.failureRiskScore ?? 0) * 100; historyMap.set(row.localDate, current) })
  const history = [...historyMap.values()].sort((left, right) => left.localDate.localeCompare(right.localDate)).map((row) => ({ ...row, health: row.health / row.count, seven: row.seven / row.count, thirty: row.thirty / row.count, risk: row.risk / row.count }))
  const stateCounts = [...devices.reduce((result, row) => result.set(row.operationalState ?? 'SIN_ESTADO', (result.get(row.operationalState ?? 'SIN_ESTADO') ?? 0) + 1), new Map<string, number>()).entries()].sort((left, right) => right[1] - left[1])
  const reasonCounts = [...devices.reduce((result, row) => result.set(row.dominantReasonCode ?? 'SIN_CAUSA', (result.get(row.dominantReasonCode ?? 'SIN_CAUSA') ?? 0) + 1), new Map<string, number>()).entries()].sort((left, right) => right[1] - left[1])
  const latestHourlyMap = new Map<string, DeviceHour & { tenantId: string; tenantName: string }>()
  hourly.forEach((row) => { const key = `${row.tenantId}|${row.deviceId}|${row.locationId}|${row.subLocationId}`; const current = latestHourlyMap.get(key); if (!current || row.localTimeSpan > current.localTimeSpan) latestHourlyMap.set(key, row) })
  const latestHourly = [...latestHourlyMap.values()]
  const burden = devices.map((device) => { const rows = daily.filter((row) => row.tenantId === device.tenantId && row.deviceId === device.deviceId && row.locationId === device.locationId && row.subLocationId === device.subLocationId); return { ...device, critical: rows.reduce((sum, row) => sum + row.criticalHours, 0), degraded: rows.reduce((sum, row) => sum + row.degradedHours, 0), watch: rows.reduce((sum, row) => sum + row.watchHours, 0), eventMinutes: rows.reduce((sum, row) => sum + (row.eventMinutes ?? 0), 0) } }).sort((left, right) => right.critical + right.degraded + right.watch - left.critical - left.degraded - left.watch)
  const maxBurden = Math.max(1, ...burden.map((row) => row.critical + row.degraded + row.watch))

  async function toggleDetail(device: Device & { tenantId: string; tenantName: string }) {
    const key = `${device.tenantId}|${device.deviceId}|${device.locationId}|${device.subLocationId}|${device.localDate}`
    if (expandedKey === key) { setExpandedKey(null); return }
    setExpandedKey(key)
    if (!device.locationId || !device.subLocationId) { setDetail({ key, data: null, loading: false, error: 'La fila no contiene la ubicacion completa necesaria para consultar evidencia.' }); return }
    setDetail({ key, data: null, loading: true, error: '' })
    try {
      const query = new URLSearchParams({ tenant: device.tenantId, device: device.deviceId, location: device.locationId, subLocation: device.subLocationId, date: device.localDate })
      const response = await fetch(`${context.apiBaseUrl}/api/devices/detail?${query}`, { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined })
      if (!response.ok) throw new Error('detail_failed')
      setDetail({ key, data: await response.json() as DeviceDetailResponse, loading: false, error: '' })
    } catch {
      setDetail({ key, data: null, loading: false, error: 'No fue posible consultar la evidencia horaria del dispositivo.' })
    }
  }

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
    <div className="page-heading"><header>
      <div>
        <span className="eyebrow">ICOS · DISPOSITIVOS</span>
        <h1>Inteligencia operacional</h1>
        <p>Riesgo primero; recomendación y evidencia después.</p>
      </div>
      <div className="badges">
        <span className={`release-${manifest.releaseStage.toLowerCase()}`}>Módulo · {manifest.releaseStage}</span>
        <span className={`data-${manifest.dataEnvironment.toLowerCase()}`}>Datos · {manifest.dataEnvironment}</span>
      </div>
    </header>

    <section className={`verdict ${critical ? 'critical' : attention ? 'warning' : available.length ? 'healthy' : 'neutral'}`}>
      <div><span>N1 · ESTADO OBSERVADO</span><strong>{verdict}</strong></div>
      <p>{critical
        ? 'Actúe sobre el mayor riesgo y valide confianza antes de intervenir.'
        : attention
          ? 'Compare tendencia, razón dominante y acción recomendada.'
          : 'Qué sigue: vigile degradación y cambios contra el periodo anterior.'}</p>
    </section></div>

    <section className="metrics">
      <article><span>Salud ponderada</span><strong>{number(health, 1)}</strong><p>{baseline(delta(health, healthPrevious))}</p></article>
      <article><span>Requieren atención</span><strong>{attention}</strong><p>de {observed} observados</p></article>
      <article><span>Críticos</span><strong>{critical}</strong><p>{degrading} con tendencia degradante</p></article>
      <article><span>Tenants con evidencia</span><strong>{available.length}/{data.tenants.length}</strong><p>Ausencia no se interpreta como cero</p></article>
    </section>

    {context.tenantIds.length !== 1 && <section className="coverage">
      <div className="section-heading"><div><span>RED</span><h2>Salud por tenant</h2></div><small>Peor condición primero</small></div>
      {[...data.tenants]
        .sort((left, right) => right.current.criticalDevices - left.current.criticalDevices
          || right.current.attentionDevices - left.current.attentionDevices)
        .map((tenant) => <TenantRow key={tenant.tenantId} tenant={tenant} />)}
    </section>}

    <section className="families">
      <div className="section-heading"><div><span>ALCANCE</span><h2>Familias observadas</h2></div><small>Clasificación conservadora</small></div>
      <div className="family-grid">{(['CUARTO_FRIO', 'HVAC', 'BASCULA', 'SEGURIDAD', 'NO_CLASIFICADO'] as const).map((kind) => {
        const rows = devices.filter((device) => device.equipmentKind === kind)
        return <article key={kind}><span>{equipmentLabel(kind)}</span><strong>{rows.length}</strong><small>{rows.filter((item) => item.operationalState === 'CRITICAL').length} críticos</small></article>
      })}</div>
    </section>

    <section className="analytic-card history-panel"><div className="section-heading"><div><span>EVOLUCION DEL PORTAFOLIO</span><h2>Salud, ventanas moviles y riesgo</h2></div><small>{history.length} dias</small></div><div className="chart-legend"><span className="teal">Salud diaria</span><span className="green">Promedio 7 dias</span><span className="gray">Promedio 30 dias</span><span className="orange">Riesgo</span></div><div className="large-line-chart"><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img">{[20, 40, 60, 80].map((y) => <line key={y} x1="0" y1={y} x2="100" y2={y} />)}<polyline className="teal-line" points={chartPoints(history.map((row) => row.health))} /><polyline className="green-line" points={chartPoints(history.map((row) => row.seven))} /><polyline className="gray-line" points={chartPoints(history.map((row) => row.thirty))} /><polyline className="orange-line" points={chartPoints(history.map((row) => row.risk))} /></svg><div className="chart-labels">{history.map((row, index) => index % Math.max(1, Math.ceil(history.length / 7)) === 0 ? <span key={row.localDate}>{row.localDate.slice(5)}</span> : null)}</div></div></section>

    <div className="analytic-grid">
      <section className="analytic-card"><div className="section-heading"><div><span>ULTIMO DIA</span><h2>Distribucion de estados</h2></div><small>{devices.length} dispositivos</small></div><div className="distribution-list">{stateCounts.map(([name, count]) => <div key={name}><span className={`state-dot ${name.toLowerCase()}`} /><strong>{stateLabels[name] ?? name}</strong><i><b style={{ width: `${count / Math.max(1, devices.length) * 100}%` }} /></i><span>{count}</span></div>)}</div></section>
      <section className="analytic-card"><div className="section-heading"><div><span>DIAGNOSTICO DOMINANTE</span><h2>Causas que explican el estado</h2></div><small>Primera regla aplicable</small></div><div className="reason-list">{reasonCounts.map(([reason, count]) => <div key={reason}><div><strong>{reasonLabels[reason] ?? reason}</strong><small>{reason}</small></div><span>{count} · {(count / Math.max(1, devices.length) * 100).toFixed(0)}%</span></div>)}</div></section>
      <section className="analytic-card"><div className="section-heading"><div><span>PRIORIZACION</span><h2>Salud contra riesgo de falla</h2></div><small>Cada punto es un dispositivo</small></div><div className="risk-matrix"><span className="risk-y">Salud alta</span><span className="risk-x">Riesgo alto</span><i className="risk-vline" /><i className="risk-hline" />{devices.map((row) => <button type="button" key={`${row.tenantId}-${row.deviceId}-${row.locationId}-${row.subLocationId}`} className={`risk-point ${(row.operationalState ?? '').toLowerCase()}`} style={{ left: `${Math.min(98, Math.max(2, (row.failureRiskScore ?? 0) * 100))}%`, top: `${Math.min(96, Math.max(4, 100 - (row.healthScore ?? 0)))}%` }} title={`${row.deviceName ?? row.deviceId}: salud ${number(row.healthScore, 1)}% · riesgo ${number((row.failureRiskScore ?? 0) * 100, 1)}%`} onClick={() => void toggleDetail(row)} />)}</div></section>
    </div>

    <section className="analytic-card heatmap-panel"><div className="section-heading"><div><span>HISTORICO DIARIO</span><h2>Salud diaria por dispositivo</h2></div><small>{deviceDates.length} dias · {devices.length} dispositivos</small></div><div className="timeline-legend"><span><i className="zero" />0%</span><span><i className="mid" />50%</span><span><i className="high" />100%</span></div><div className="timeline-scroll"><div className="timeline-matrix" style={{ minWidth: `${Math.max(760, deviceDates.length * 15 + 190)}px` }}><div className="timeline-row timeline-header" style={{ gridTemplateColumns: `180px repeat(${Math.max(1, deviceDates.length)}, minmax(12px, 1fr))` }}><strong>Dispositivo</strong>{deviceDates.map((date, index) => <span key={date}>{index % Math.max(1, Math.ceil(deviceDates.length / 10)) === 0 ? date.slice(5) : ''}</span>)}</div>{devices.map((device) => <div className="timeline-row" key={`${device.tenantId}-${device.deviceId}-${device.locationId}-${device.subLocationId}`} style={{ gridTemplateColumns: `180px repeat(${Math.max(1, deviceDates.length)}, minmax(12px, 1fr))` }}><div className="timeline-label"><strong>{device.deviceName ?? device.deviceId.slice(0, 8)}</strong><span>{device.tenantName} · {device.deviceType ?? 'Sin tipo'}</span></div>{deviceDates.map((date) => { const row = dailyRows.get(`${device.tenantId}|${device.deviceId}|${device.locationId}|${device.subLocationId}|${date}`); const intensity = row ? .05 + Math.min(Math.max(row.healthScore ?? 0, 0), 100) / 100 * .9 : .03; return <button type="button" key={date} className="timeline-cell" disabled={!row} onClick={() => row && void toggleDetail({ ...device, localDate: row.localDate })} style={{ backgroundColor: `rgba(20,135,112,${intensity})` }} title={row ? `${date}: salud ${number(row.healthScore, 1)}% · ${stateLabels[row.operationalState ?? ''] ?? row.operationalState} · riesgo ${number((row.failureRiskScore ?? 0) * 100, 1)}%` : `${date}: sin dato`} /> })}</div>)}</div></div></section>

    <div className="detail-grid">
      <section className="analytic-card"><div className="section-heading"><div><span>CARGA OPERATIVA DEL PERIODO</span><h2>Horas afectadas por dispositivo</h2></div><small>Criticas · degradadas · vigilancia</small></div><div className="burden-list">{burden.map((row) => <div key={`${row.tenantId}-${row.deviceId}`}><label><strong>{row.deviceName ?? row.deviceId}</strong><span>{row.eventMinutes.toFixed(0)} min en eventos</span></label><div><i className="critical" style={{ width: `${row.critical / maxBurden * 100}%` }} /><i className="degraded" style={{ width: `${row.degraded / maxBurden * 100}%` }} /><i className="watch" style={{ width: `${row.watch / maxBurden * 100}%` }} /></div><b>{row.critical} C · {row.degraded} D · {row.watch} V</b></div>)}</div></section>
      <section className="analytic-card"><div className="section-heading"><div><span>ULTIMA HORA</span><h2>Componentes que forman la salud</h2></div><small>Cobertura, rango, sensores, eventos, conducta y pares</small></div><div className="score-list">{latestHourly.map((row) => <div key={`${row.tenantId}-${row.deviceId}-${row.locationId}-${row.subLocationId}`}><label><strong>{row.deviceName ?? row.deviceId.slice(0, 8)}</strong><span>{number(row.healthScore, 1)} salud · {number((row.failureRiskScore ?? 0) * 100, 1)} riesgo</span></label><div>{[row.coverageScore, row.expectedValueComplianceScore, row.sensorReliabilityScore, row.eventStabilityScore, row.behaviorStabilityScore, row.peerAlignmentScore].map((score, index) => <span key={index}><i style={{ width: `${Math.max(0, Math.min(100, score ?? 0))}%` }} /></span>)}</div></div>)}</div></section>
    </div>

    <section className="evidence">
      <div className="section-heading"><div><span>EVIDENCIA</span><h2>Dispositivos priorizados</h2></div><small>{devices.length} de hasta 100 por tenant</small></div>
      {devices.length
        ? <div className="table-wrap"><table><thead><tr><th>Tenant y dispositivo</th><th>Familia</th><th>Estado</th><th>Salud / riesgo</th><th>Confianza</th><th>Tendencia</th><th>Razón y acción</th></tr></thead><tbody>{devices.map((device) => { const key = `${device.tenantId}|${device.deviceId}|${device.locationId}|${device.subLocationId}|${device.localDate}`; const expanded = expandedKey === key; return <Fragment key={key}><DeviceRow device={device} expanded={expanded} onToggle={() => void toggleDetail(device)} />{expanded ? <tr className="expanded-detail-row"><td colSpan={7}><DeviceDetailPanel data={detail.key === key ? detail.data : null} loading={detail.key === key && detail.loading} error={detail.key === key ? detail.error : ''} /></td></tr> : null}</Fragment> })}</tbody></table></div>
        : <div className="empty"><strong>Sin evidencia detallada en el alcance disponible</strong><span>Los tenants sin soporte o sin datos permanecen diferenciados.</span></div>}
    </section>

    <section className="analytic-card heatmap-panel"><div className="section-heading"><div><span>HISTORICO HORA A HORA</span><h2>Salud horaria por dispositivo</h2></div><small>{deviceHours.length} horas · {devices.length} dispositivos</small></div><div className="timeline-legend"><span><i className="zero" />0%</span><span><i className="mid" />50%</span><span><i className="high" />100%</span></div><div className="timeline-scroll"><div className="timeline-matrix" style={{ minWidth: `${Math.max(760, deviceHours.length * 15 + 190)}px` }}><div className="timeline-row timeline-header" style={{ gridTemplateColumns: `180px repeat(${Math.max(1, deviceHours.length)}, minmax(12px, 1fr))` }}><strong>Dispositivo</strong>{deviceHours.map((hour, index) => <span key={hour}>{index % Math.max(1, Math.ceil(deviceHours.length / 10)) === 0 ? new Intl.DateTimeFormat('es-MX', { month: 'short', day: '2-digit', hour: '2-digit' }).format(new Date(hour)) : ''}</span>)}</div>{devices.map((device) => <div className="timeline-row" key={`${device.tenantId}-${device.deviceId}-${device.locationId}-${device.subLocationId}`} style={{ gridTemplateColumns: `180px repeat(${Math.max(1, deviceHours.length)}, minmax(12px, 1fr))` }}><div className="timeline-label"><strong>{device.deviceName ?? device.deviceId.slice(0, 8)}</strong><span>{device.tenantName} · {device.deviceType ?? 'Sin tipo'}</span></div>{deviceHours.map((hour) => { const row = hourlyRows.get(`${device.tenantId}|${device.deviceId}|${device.locationId}|${device.subLocationId}|${hour}`); const intensity = row ? .05 + Math.min(Math.max(row.healthScore ?? 0, 0), 100) / 100 * .9 : .03; return <button type="button" key={hour} className="timeline-cell" disabled={!row} onClick={() => row && void toggleDetail({ ...device, localDate: row.localTimeSpan.slice(0, 10) })} style={{ backgroundColor: `rgba(20,135,112,${intensity})` }} title={row ? `${new Date(row.localTimeSpan).toLocaleString('es-MX')}: salud ${number(row.healthScore, 1)}% · riesgo ${number((row.failureRiskScore ?? 0) * 100, 1)}% · confianza ${number(row.confidenceScore, 1)}%` : `${new Date(hour).toLocaleString('es-MX')}: sin dato`} /> })}</div>)}</div></div></section>

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

function DeviceRow({ device, expanded, onToggle }: { device: Device & { tenantId: string; tenantName: string }; expanded: boolean; onToggle: () => void }) {
  const stateClass = device.operationalState === 'CRITICAL' ? 'critical-pill' : device.operationalState === 'NORMAL' ? 'healthy-pill' : 'warning-pill'
  return <tr className={`device-summary-row ${expanded ? 'expanded' : ''}`} tabIndex={0} aria-expanded={expanded} onClick={onToggle} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onToggle() } }}>
    <td><strong>{device.tenantName}</strong><span>{device.deviceName || device.deviceId}</span><span className="row-hint">{expanded ? 'Ocultar evidencia' : 'Abrir evidencia hora a hora'}</span></td>
    <td>{equipmentLabel(device.equipmentKind)}</td>
    <td><b className={stateClass}>{device.operationalState || 'Sin estado'}</b></td>
    <td><strong>{number(device.healthScore, 1)} / {number(device.failureRiskScore, 1)}</strong><span>salud / riesgo</span></td>
    <td><strong>{number(device.confidenceScore, 2)}</strong><span>{device.scoringVersion || device.modelVersion || 'Sin versión'}</span></td>
    <td>{device.trendDirection || '—'}</td>
    <td><strong>{device.dominantReasonCode || 'Sin razón dominante'}</strong><span>{device.recommendedAction || 'Sin acción prescrita'}</span></td>
  </tr>
}

function DeviceDetailPanel({ data, loading, error }: { data: DeviceDetailResponse | null; loading: boolean; error: string }) {
  const [selectedSensorId, setSelectedSensorId] = useState('')
  if (loading) return <div className="detail-state"><span />Consultando evidencia horaria, sensores, rangos, eventos y auditorias...</div>
  if (error) return <div className="detail-state error">{error}</div>
  if (!data) return null
  const readings = data.measurements.reduce((sum, row) => sum + (row.readingsCount ?? 0), 0)
  const configured = new Set(data.sensors.filter((row) => row.expectedMin != null && row.expectedMax != null).map((row) => row.sensorId)).size
  const outside = data.measurements.filter((row) => row.averageOutsideExpected).length
  const lost = data.audits.filter((row) => row.connectionLost).length
  const late = data.audits.filter((row) => row.late).length
  const eventMinutes = data.events.reduce((sum, row) => sum + (row.eventMinutes ?? 0), 0)
  const maxRisk = Math.max(1, ...data.operationalHours.map((row) => (row.failureRiskScore ?? 0) * 100))
  const configuredSensorIds = new Set(data.sensors.filter((row) => row.expectedMin != null && row.expectedMax != null).map((row) => row.sensorId))
  const sensorIds = [...new Set(data.measurements.map((row) => row.sensorId))].sort((left, right) => Number(configuredSensorIds.has(right)) - Number(configuredSensorIds.has(left)))
  const activeSensorId = sensorIds.includes(selectedSensorId) ? selectedSensorId : sensorIds[0] ?? ''
  const selectedMeasurements = data.measurements.filter((row) => row.sensorId === activeSensorId)
  const selectedSensor = selectedMeasurements[0]
  const expectedValues = selectedMeasurements.flatMap((row) => [row.measurementValue, row.expectedMin, row.expectedMax]).filter((value): value is number => value != null)
  const expectedMin = expectedValues.length ? Math.min(...expectedValues) : 0
  const expectedMax = expectedValues.length ? Math.max(...expectedValues) : 1
  const expectedRange = Math.max(0.1, expectedMax - expectedMin)
  const expectedX = (index: number) => selectedMeasurements.length === 1 ? 50 : index / Math.max(1, selectedMeasurements.length - 1) * 100
  const expectedY = (value: number) => 92 - (value - expectedMin) / expectedRange * 78
  const expectedPoints = (field: 'measurementValue' | 'expectedMin' | 'expectedMax') => selectedMeasurements.map((row, index) => row[field] == null ? null : `${expectedX(index)},${expectedY(row[field])}`).filter(Boolean).join(' ')
  const measurementByHour = new Map(data.measurements.map((row) => [`${row.sensorId}|${row.localTimeSpan}`, row]))
  const auditByHour = new Map(data.audits.map((row) => [`${row.sensorId}|${row.localTimeSpan}`, row]))
  const lossAudits = data.audits.filter((row) => row.connectionLost)
  return <div className="operational-detail">
    <div className="detail-heading"><div><span>EVIDENCIA DEL DIA</span><h3>Por que el dispositivo recibio este diagnostico</h3><p>El score horario se contrasta con mediciones, rangos programados, eventos y auditorias de continuidad.</p></div><strong>{data.device.localDate}</strong></div>
    <div className="detail-kpis"><div><span>Horas diagnosticadas</span><strong>{data.operationalHours.length}</strong></div><div><span>Lecturas agregadas</span><strong>{readings.toLocaleString('es-MX')}</strong></div><div><span>Sensores con rango</span><strong>{configured}/{new Set(data.sensors.map((row) => row.sensorId)).size}</strong></div><div><span>Promedios fuera de rango</span><strong className={outside ? 'bad' : 'good'}>{outside}</strong></div><div><span>Perdidas / tardanzas</span><strong className={lost ? 'bad' : late ? 'warn' : 'good'}>{lost} / {late}</strong></div><div><span>Eventos</span><strong>{data.events.length}</strong><small>{eventMinutes.toFixed(1)} min</small></div></div>
    <div className="detail-two-columns">
      <section className="detail-section"><div className="detail-section-heading"><div><span>DIAGNOSTICO HORA A HORA</span><h4>Salud y riesgo de falla</h4></div><small>{data.operationalHours.length} cortes</small></div><div className="chart-legend"><span className="teal">Salud</span><span className="orange">Riesgo</span></div><div className="large-line-chart detail-chart"><svg viewBox="0 0 100 100" preserveAspectRatio="none">{[20, 40, 60, 80].map((y) => <line key={y} x1="0" y1={y} x2="100" y2={y} />)}<polyline className="teal-line" points={chartPoints(data.operationalHours.map((row) => row.healthScore ?? 0))} /><polyline className="orange-line" points={chartPoints(data.operationalHours.map((row) => (row.failureRiskScore ?? 0) * 100), maxRisk)} /></svg><div className="chart-labels">{data.operationalHours.map((row, index) => index % Math.max(1, Math.ceil(data.operationalHours.length / 8)) === 0 ? <span key={row.localTimeSpan}>{new Date(row.localTimeSpan).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span> : null)}</div></div></section>
      <section className="detail-section"><div className="detail-section-heading"><div><span>VALOR VS ESPERADO</span><h4>{selectedSensor ? `${selectedSensor.sensorName ?? selectedSensor.sensorId.slice(0, 8)} · ${selectedSensor.sensorType ?? 'Sin tipo'}` : 'Sin mediciones'}</h4></div>{sensorIds.length > 0 && <select value={activeSensorId} onChange={(event) => setSelectedSensorId(event.target.value)} aria-label="Sensor para comparar contra su rango esperado">{sensorIds.map((sensorId) => { const row = data.measurements.find((measurement) => measurement.sensorId === sensorId); return <option key={sensorId} value={sensorId}>{row?.sensorName ?? sensorId.slice(0, 8)}</option> })}</select>}</div>{selectedMeasurements.length ? <div className="large-line-chart detail-chart expected-chart"><svg viewBox="0 0 100 100" preserveAspectRatio="none">{[20, 40, 60, 80].map((y) => <line key={y} x1="0" y1={y} x2="100" y2={y} />)}<polyline className="expected-min" points={expectedPoints('expectedMin')} /><polyline className="expected-max" points={expectedPoints('expectedMax')} /><polyline className="measurement-line" points={expectedPoints('measurementValue')} />{selectedMeasurements.map((row, index) => row.measurementValue == null ? null : <circle key={`${row.localTimeSpan}-${index}`} className={row.averageOutsideExpected ? 'outside' : 'inside'} cx={expectedX(index)} cy={expectedY(row.measurementValue)} r="1.8"><title>{new Date(row.localTimeSpan).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}: {number(row.measurementValue, 2)} · esperado {row.expectedMin == null || row.expectedMax == null ? 'sin rango' : `${number(row.expectedMin, 2)}–${number(row.expectedMax, 2)}`}</title></circle>)}</svg><div className="chart-labels"><span>{selectedMeasurements[0] ? new Date(selectedMeasurements[0].localTimeSpan).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : ''}</span><span>{selectedMeasurements.at(-1) ? new Date(selectedMeasurements.at(-1)!.localTimeSpan).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : ''}</span></div></div> : <div className="detail-state">Sin mediciones para comparar.</div>}</section>
    </div>
    <section className="detail-section"><div className="detail-section-heading"><div><span>CONTINUIDAD</span><h4>Horas con pérdida de comunicación</h4></div><small>{lossAudits.length} pérdidas</small></div><div className="loss-badges">{lossAudits.length ? lossAudits.map((row, index) => <span key={`${row.sensorId}-${row.localTimeSpan}-${index}`}><strong>{row.sensorName ?? row.sensorId.slice(0, 8)}</strong> · pérdida a las {new Date(row.localTimeSpan).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}{row.minutesWithoutReadings != null ? ` · ${number(row.minutesWithoutReadings, 0)} min` : ''}</span>) : <span className="healthy">Sin pérdidas registradas</span>}</div></section>
    <section className="detail-section"><div className="detail-section-heading"><div><span>ESTADO Y MEDICIONES</span><h4>Evidencia hora por hora</h4></div><small>{sensorIds.length} sensores</small></div><div className="nested-table hourly-status-table"><table><thead><tr><th>Hora</th><th>Dispositivo</th><th>Salud / riesgo</th><th>Confianza</th><th>Causa dominante</th>{sensorIds.map((sensorId) => <th key={sensorId}>{data.measurements.find((row) => row.sensorId === sensorId)?.sensorName ?? sensorId.slice(0, 8)}</th>)}</tr></thead><tbody>{data.operationalHours.map((hour) => <tr key={hour.localTimeSpan} title={`Recomendación: ${hour.recommendedAction ?? 'Sin acción registrada.'}`}><td><strong>{new Date(hour.localTimeSpan).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</strong></td><td><b className={hour.operationalState === 'CRITICAL' ? 'critical-pill' : hour.operationalState === 'NORMAL' ? 'healthy-pill' : 'warning-pill'}>{stateLabels[hour.operationalState ?? ''] ?? hour.operationalState ?? 'Sin estado'}</b></td><td>{number(hour.healthScore, 1)} / {number((hour.failureRiskScore ?? 0) * 100, 1)}%</td><td>{number(hour.confidenceScore, 1)}%</td><td>{reasonLabels[hour.dominantReasonCode ?? ''] ?? hour.dominantReasonCode ?? 'Sin causa'}</td>{sensorIds.map((sensorId) => { const measurement = measurementByHour.get(`${sensorId}|${hour.localTimeSpan}`); const audit = auditByHour.get(`${sensorId}|${hour.localTimeSpan}`); return <td key={sensorId}><strong>{number(measurement?.measurementValue ?? null, 2)}</strong><span>{audit?.connectionLost ? 'Pérdida' : audit?.late ? 'Tardío' : measurement?.averageOutsideExpected ? 'Fuera de rango' : measurement ? 'Reportando' : 'Sin dato'}</span></td> })}</tr>)}</tbody></table></div></section>
  </div>
}
