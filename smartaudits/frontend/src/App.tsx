import { useEffect, useMemo, useState } from 'react'
import { aggregate, coverageLabel, delta } from './metrics'
import ReviewQueue from './ReviewQueue'
import type { DashboardResponse, HostContext, Manifest, TenantResult } from './types'

const number = (value: number | null, digits = 0) => value == null
  ? '—'
  : new Intl.NumberFormat('es-MX', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)

const resultLabel = (value: string | null) => value == null ? 'Sin causa' : ({
  CUMPLIMIENTO: 'Cumplimiento',
  IMAGEN_NO_PROCESABLE: 'Imagen no procesable',
  IMAGEN_NO_LEGIBLE: 'Imagen no legible',
  FUERA_DE_RANGO: 'Fuera de rango',
  INCUMPLIMIENTO_LIMPIEZA: 'Incumplimiento de limpieza',
  INCUMPLIMIENTO_GENERAL: 'Incumplimiento general',
  SIN_CLASIFICAR: 'Sin clasificar',
}[value] ?? value)

export default function App({ context }: { context: HostContext }) {
  const [manifest, setManifest] = useState<Manifest | null>(null)
  const [data, setData] = useState<DashboardResponse | null>(null)
  const [token, setToken] = useState('')
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [section, setSection] = useState<'overview' | 'queue'>('overview')

  useEffect(() => {
    let active = true
    void (async () => {
      setState('loading')
      try {
        const accessToken = await context.auth.getAccessToken('smartaudits')
        const query = new URLSearchParams({ from: context.period.from, to: context.period.to })
        if (context.tenantIds.length) query.set('tenant', context.tenantIds.join(','))
        const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
        const [manifestResponse, dataResponse] = await Promise.all([
          fetch(`${context.apiBaseUrl}/api/module/manifest`),
          fetch(`${context.apiBaseUrl}/api/smartaudits?${query}`, { headers }),
        ])
        if (!manifestResponse.ok || !dataResponse.ok) throw new Error('load_failed')
        const [nextManifest, nextData] = await Promise.all([
          manifestResponse.json() as Promise<Manifest>,
          dataResponse.json() as Promise<DashboardResponse>,
        ])
        if (active) {
          setManifest(nextManifest)
          setData(nextData)
          setToken(accessToken)
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
  const current = aggregate(available)
  const previous = aggregate(available, true)
  const categories = useMemo(() => {
    const totals = new Map<string, { count: number; locations: number; tasks: number }>()
    available.flatMap((tenant) => tenant.categories).forEach((category) => {
      const existing = totals.get(category.resultCategory) ?? { count: 0, locations: 0, tasks: 0 }
      existing.count += category.resultCount
      existing.locations += category.locationCount
      existing.tasks += category.taskCount
      totals.set(category.resultCategory, existing)
    })
    return [...totals.entries()].sort((left, right) => right[1].count - left[1].count)
  }, [available])
  const locations = useMemo(
    () => available.flatMap((tenant) => tenant.locations.map((location) => ({ ...location, tenantName: tenant.tenantName })))
      .sort((left, right) => right.nonComplianceResults - left.nonComplianceResults),
    [available],
  )
  const recurrent = useMemo(
    () => available.flatMap((tenant) => tenant.recurrentIssues.map((issue) => ({ ...issue, tenantName: tenant.tenantName })))
      .sort((left, right) => right.recurrenceCount - left.recurrenceCount),
    [available],
  )

  if (state === 'loading') return <section className="state"><strong>Consolidando SmartAudits</strong><span>Separando cumplimiento, causas y cobertura.</span></section>
  if (state === 'error' || !manifest || !data) return <section className="state error"><strong>SmartAudits no está disponible</strong><span>La falla queda aislada dentro de este módulo.</span></section>

  const verdict = current.unclassifiedResults
    ? `${current.unclassifiedResults} resultados permanecen sin clasificar.`
    : current.operationalIssues
      ? `${current.operationalIssues} incumplimientos operativos requieren atención.`
      : available.length
        ? 'La evidencia observada no presenta pendientes de clasificación.'
        : 'No existe evidencia suficiente para evaluar SmartAudits.'

  return <main className="app">
    <header>
      <div><span className="eyebrow">ICOS · SMARTAUDITS</span><h1>Decisión y trazabilidad</h1><p>Resultados, causas y revisión humana en una sola lectura operacional.</p></div>
      <div className="badges"><span>Módulo · {manifest.releaseStage}</span><span>Datos · {manifest.dataEnvironment} / {manifest.freshnessMode}</span><span>Analítica · 7 tenants</span><span>Cola humana · Carls Jr</span><span>Clearance · {manifest.clearance}</span></div>
    </header>
    <nav className="tabs" aria-label="Secciones de SmartAudits"><button type="button" className={section === 'overview' ? 'active' : ''} onClick={() => setSection('overview')}>Panorama operacional</button><button type="button" className={section === 'queue' ? 'active' : ''} onClick={() => setSection('queue')}>Cola de revisión</button></nav>

    {section === 'queue'
      ? <ReviewQueue context={context} token={token} />
      : <>
          <section className={`verdict ${current.unclassifiedResults ? 'critical' : current.operationalIssues ? 'warning' : available.length ? 'healthy' : 'neutral'}`}><div><span>N1 · ESTADO OBSERVADO</span><strong>{verdict}</strong></div><p>{current.unclassifiedResults ? 'Revise primero recurrencia y evidencia; la cola humana sólo opera para Carls Jr.' : current.operationalIssues ? 'Priorice causas repetidas, sucursal y tarea antes de intervenir.' : 'Qué sigue: vigile cambios frente al periodo anterior.'}</p></section>
          <section className="metrics"><article><span>Cumplimiento ponderado</span><strong>{number(current.complianceRate, 1)}%</strong><p>{delta(current.complianceRate, previous.complianceRate) == null ? 'Sin baseline comparable' : `${number(delta(current.complianceRate, previous.complianceRate), 1)} pp vs. periodo anterior`}</p></article><article><span>Resultados</span><strong>{number(current.resultCount)}</strong><p>{current.operationalIssues} fallas operativas</p></article><article><span>Evidencia fallida</span><strong>{number(current.evidenceFailureRate, 1)}%</strong><p>{current.imageQualityIssues} problemas de imagen</p></article><article><span>Tenants con evidencia</span><strong>{available.length}/{data.tenants.length}</strong><p>Ausencia no se interpreta como cero</p></article></section>
          <section className="coverage"><div className="section-heading"><div><span>RED</span><h2>Cobertura y resultado por tenant</h2></div><small>Incumplimiento primero</small></div>{[...data.tenants].sort((left, right) => right.current.nonComplianceResults - left.current.nonComplianceResults).map((tenant) => <TenantRow key={tenant.tenantId} tenant={tenant} />)}</section>
          <div className="split">
            <section className="categories"><div className="section-heading"><div><span>CAUSAS</span><h2>Composición de resultados</h2></div><small>Volumen absoluto y participación</small></div><div className="category-list">{categories.map(([name, value]) => <article key={name}><div><strong>{resultLabel(name)}</strong><span>{value.locations} ubicaciones · {value.tasks} tareas</span></div><b>{number(value.count)}</b><i><span style={{ width: `${current.resultCount ? value.count / current.resultCount * 100 : 0}%` }} /></i></article>)}</div></section>
            <section className="locations"><div className="section-heading"><div><span>PRIORIZACIÓN</span><h2>Ubicaciones con mayor carga</h2></div><small>Hasta 100 por tenant</small></div><div className="location-list">{locations.slice(0, 12).map((location, index) => <article key={`${location.tenantName}-${location.locationId}-${index}`}><div><strong>{location.locationName}</strong><span>{location.tenantName} · {location.taskCount} tareas</span></div><div><b>{location.nonComplianceResults} fallas</b><span>{number(location.complianceRate, 1)}% cumplimiento</span></div><p>Principal: {resultLabel(location.topIssueCategory)} · evidencia fallida {number(location.evidenceFailureRate, 1)}%</p></article>)}</div></section>
          </div>
          <section className="recurrent"><div className="section-heading"><div><span>EVIDENCIA</span><h2>Incumplimientos recurrentes</h2></div><small>La recurrencia no equivale a severidad</small></div>{recurrent.length ? <div className="table-wrap"><table><thead><tr><th>Tenant y ubicación</th><th>Tarea</th><th>Causa</th><th>Recurrencias</th><th>Planes</th><th>Evidencia fallida</th><th>Ventana</th></tr></thead><tbody>{recurrent.slice(0, 100).map((issue, index) => <tr key={`${issue.tenantName}-${issue.locationId}-${issue.taskId}-${issue.resultCategory}-${index}`}><td><strong>{issue.tenantName}</strong><span>{issue.locationName} · {issue.sublocationName}</span></td><td>{issue.taskName}</td><td><b className="cause-pill">{resultLabel(issue.resultCategory)}</b></td><td>{issue.recurrenceCount}</td><td>{issue.workPlanCount}</td><td>{issue.failedEvidenceCount}</td><td>{issue.firstDate || '—'}<span>a {issue.lastDate || '—'}</span></td></tr>)}</tbody></table></div> : <div className="empty"><strong>Sin combinaciones fallidas repetidas</strong><span>La ausencia se limita al alcance con datos.</span></div>}</section>
          <section className="next"><div><span>N2 · RECOMENDACIÓN</span><h2>{current.unclassifiedResults ? 'Convierta recurrencia sin clasificar en conocimiento humano.' : current.operationalIssues ? 'Ataque la causa repetida con mayor alcance.' : 'Mantenga vigilancia por excepción.'}</h2></div><p>Impacto esperado: disminuir reincidencia sin confundir calidad de evidencia, clasificación y cumplimiento operacional.</p></section>
        </>}
    <footer><span>Generado {new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(data.generatedAt))}</span><span>{context.timezone}</span></footer>
  </main>
}

function TenantRow({ tenant }: { tenant: TenantResult }) {
  if (tenant.coverageStatus !== 'AVAILABLE') return <article className="tenant unavailable"><div><strong>{tenant.tenantName}</strong><span>{coverageLabel(tenant.coverageStatus)}</span></div><p>{tenant.coverageStatus === 'NO_DATA' ? 'El fact existe sin resultados en el periodo.' : tenant.coverageStatus === 'NOT_SUPPORTED' ? 'El fact SmartAudits no existe para este tenant.' : 'La conexión o consulta no está disponible.'}</p></article>
  return <article className="tenant"><div><strong>{tenant.tenantName}</strong><span>Disponible</span></div><div><span>Cumplimiento <b>{number(tenant.current.complianceRate, 1)}%</b></span><span>Resultados <b>{tenant.current.resultCount}</b></span><span>Fallas <b>{tenant.current.nonComplianceResults}</b></span><span>Sin clasificar <b>{tenant.current.unclassifiedResults}</b></span></div><i><b style={{ width: `${Math.max(0, Math.min(tenant.current.complianceRate ?? 0, 100))}%` }} /></i></article>
}
