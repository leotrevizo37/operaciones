import { useEffect, useMemo, useState } from 'react'
import { aggregate, coverageLabel, cultureScore, delta } from './metrics'
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
const rowNumber = (row: Record<string, unknown>, field: string) => Number(row[field] ?? 0)
const rowText = (row: Record<string, unknown>, field: string, fallback = '—') => row[field] == null ? fallback : String(row[field])

export default function App({ context }: { context: HostContext }) {
  const [manifest, setManifest] = useState<Manifest | null>(null)
  const [data, setData] = useState<DashboardResponse | null>(null)
  const [token, setToken] = useState('')
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [section, setSection] = useState<'panorama' | 'sucursales' | 'tareas' | 'clasificacion' | 'personas' | 'detalle' | 'queue'>('panorama')
  const [detailSearch, setDetailSearch] = useState('')

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
    () => available.flatMap((tenant) => tenant.locations.map((location) => ({ ...location, tenantId: tenant.tenantId, tenantName: tenant.tenantName })))
      .sort((left, right) => right.nonComplianceResults - left.nonComplianceResults),
    [available],
  )
  const recurrent = useMemo(
    () => available.flatMap((tenant) => tenant.recurrentIssues.map((issue) => ({ ...issue, tenantName: tenant.tenantName })))
      .sort((left, right) => right.recurrenceCount - left.recurrenceCount),
    [available],
  )
  const decorate = (field: 'sublocations' | 'locationCategories' | 'taskCategories' | 'priorities' | 'tasks' | 'methods' | 'methodCategories' | 'models' | 'executors' | 'auditors' | 'details'): Record<string, unknown>[] => available.flatMap((tenant) => (tenant[field] ?? []).map((row) => ({ ...(row as Record<string, unknown>), TenantId: tenant.tenantId, TenantName: tenant.tenantName })))
  const sublocations = decorate('sublocations')
  const locationCategories = decorate('locationCategories')
  const taskCategories = decorate('taskCategories')
  const priorities = decorate('priorities')
  const tasks = decorate('tasks')
  const methods = decorate('methods')
  const methodCategories = decorate('methodCategories')
  const models = decorate('models')
  const executors = decorate('executors')
  const auditors = decorate('auditors')
  const details = decorate('details')
  const visibleDetails = details.filter((row) => !detailSearch || Object.values(row).some((value) => String(value ?? '').toLocaleLowerCase('es-MX').includes(detailSearch.toLocaleLowerCase('es-MX'))))
  const locationCategoryMap = new Map(locationCategories.map((row) => [`${row.TenantId}|${row.LocationId}|${row.ResultCategory}`, row]))
  const maxLocationCategoryCount = Math.max(1, ...locationCategories.map((row) => rowNumber(row, 'ResultCount')))
  const quality = available.reduce<Record<string, number>>((result, tenant) => { Object.entries(tenant.dataQuality ?? {}).forEach(([key, value]) => { result[key] = (result[key] ?? 0) + Number(value ?? 0) }); return result }, {})
  const unprocessable = categories.find(([name]) => name === 'IMAGEN_NO_PROCESABLE')?.[1].count ?? 0
  const illegible = categories.find(([name]) => name === 'IMAGEN_NO_LEGIBLE')?.[1].count ?? 0
  const culture = cultureScore(current.resultCount, unprocessable, illegible)

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
    <div className="page-heading"><header>
      <div><span className="eyebrow">ICOS · SMARTAUDITS</span><h1>Decisión y trazabilidad</h1><p>Resultados, causas y revisión humana en una sola lectura operacional.</p></div>
      <div className="badges"><span className={`release-${manifest.releaseStage.toLowerCase()}`}>Módulo · {manifest.releaseStage}</span><span className={`data-${manifest.dataEnvironment.toLowerCase()}`}>Datos · {manifest.dataEnvironment}</span><span className="review-scope">Cola humana · Carls Jr</span></div>
    </header>
    {section !== 'queue' && <section className={`verdict ${current.unclassifiedResults ? 'critical' : current.operationalIssues ? 'warning' : available.length ? 'healthy' : 'neutral'}`}><div><span>N1 · ESTADO OBSERVADO</span><strong>{verdict}</strong></div><p>{current.unclassifiedResults ? 'Revise primero recurrencia y evidencia; la cola humana sólo opera para Carls Jr.' : current.operationalIssues ? 'Priorice causas repetidas, sucursal y tarea antes de intervenir.' : 'Qué sigue: vigile cambios frente al periodo anterior.'}</p></section>}</div>
    <nav className="tabs" aria-label="Secciones de SmartAudits">{([['panorama', 'Panorama'], ['sucursales', 'Sucursales'], ['tareas', 'Tareas y recurrencia'], ['clasificacion', 'Clasificación'], ['personas', 'Personas'], ['detalle', 'Detalle'], ['queue', 'Cola de revisión']] as const).map(([value, label]) => <button type="button" key={value} className={section === value ? 'active' : ''} onClick={() => setSection(value)}>{label}</button>)}</nav>

    {section === 'queue'
      ? <ReviewQueue context={context} token={token} />
      : <>
          <section className="metrics"><article><span>Cumplimiento ponderado</span><strong>{number(current.complianceRate, 1)}%</strong><p>{delta(current.complianceRate, previous.complianceRate) == null ? 'Sin baseline comparable' : `${number(delta(current.complianceRate, previous.complianceRate), 1)} pp vs. periodo anterior`}</p></article><article><span>Cultura de evidencia</span><strong>{number(culture, 1)}%</strong><p>Penaliza no procesable 90% y no legible 10%</p></article><article><span>Resultados</span><strong>{number(current.resultCount)}</strong><p>{current.operationalIssues} fallas operativas</p></article><article><span>Evidencia fallida</span><strong>{number(current.evidenceFailureRate, 1)}%</strong><p>{current.imageQualityIssues} problemas de imagen</p></article><article><span>Tenants con evidencia</span><strong>{available.length}/{data.tenants.length}</strong><p>Ausencia no se interpreta como cero</p></article></section>
          {context.tenantIds.length !== 1 && <section className="coverage"><div className="section-heading"><div><span>RED</span><h2>Cobertura y resultado por tenant</h2></div><small>Incumplimiento primero</small></div>{[...data.tenants].sort((left, right) => right.current.nonComplianceResults - left.current.nonComplianceResults).map((tenant) => <TenantRow key={tenant.tenantId} tenant={tenant} />)}</section>}
          {section === 'panorama' && <>
          <div className="split">
            <section className="categories"><div className="section-heading"><div><span>CAUSAS</span><h2>Composición de resultados</h2></div><small>Volumen absoluto y participación</small></div><div className="category-list">{categories.map(([name, value]) => <article key={name}><div><strong>{resultLabel(name)}</strong><span>{value.locations} ubicaciones · {value.tasks} tareas</span></div><b>{number(value.count)}</b><i><span style={{ width: `${current.resultCount ? value.count / current.resultCount * 100 : 0}%` }} /></i></article>)}</div></section>
            <section className="locations"><div className="section-heading"><div><span>PRIORIZACIÓN</span><h2>Ubicaciones con mayor carga</h2></div><small>Hasta 100 por tenant</small></div><div className="location-list">{locations.slice(0, 12).map((location, index) => <article key={`${location.tenantName}-${location.locationId}-${index}`}><div><strong>{location.locationName}</strong><span>{location.tenantName} · {location.taskCount} tareas</span></div><div><b>{location.nonComplianceResults} fallas</b><span>{number(location.complianceRate, 1)}% cumplimiento</span></div><p>Principal: {resultLabel(location.topIssueCategory)} · evidencia fallida {number(location.evidenceFailureRate, 1)}%</p></article>)}</div></section>
          </div>
          <section className="recurrent"><div className="section-heading"><div><span>EVIDENCIA</span><h2>Incumplimientos recurrentes</h2></div><small>La recurrencia no equivale a severidad</small></div>{recurrent.length ? <div className="table-wrap"><table><thead><tr><th>Tenant y ubicación</th><th>Tarea</th><th>Causa</th><th>Recurrencias</th><th>Planes</th><th>Evidencia fallida</th><th>Ventana</th></tr></thead><tbody>{recurrent.slice(0, 100).map((issue, index) => <tr key={`${issue.tenantName}-${issue.locationId}-${issue.taskId}-${issue.resultCategory}-${index}`}><td><strong>{issue.tenantName}</strong><span>{issue.locationName} · {issue.sublocationName}</span></td><td>{issue.taskName}</td><td><b className="cause-pill">{resultLabel(issue.resultCategory)}</b></td><td>{issue.recurrenceCount}</td><td>{issue.workPlanCount}</td><td>{issue.failedEvidenceCount}</td><td>{issue.firstDate || '—'}<span>a {issue.lastDate || '—'}</span></td></tr>)}</tbody></table></div> : <div className="empty"><strong>Sin combinaciones fallidas repetidas</strong><span>La ausencia se limita al alcance con datos.</span></div>}</section>
          </>}
          {section === 'sucursales' && <LocationsPanel locations={locations} categories={categories.map(([name]) => name)} sublocations={sublocations} locationCategoryMap={locationCategoryMap} maximum={maxLocationCategoryCount} />}
          {section === 'tareas' && <TasksPanel priorities={priorities} categories={taskCategories} tasks={tasks} recurrent={recurrent} />}
          {section === 'clasificacion' && <ClassificationPanel methods={methods} categories={categories.map(([name]) => name)} methodCategories={methodCategories} models={models} quality={quality} />}
          {section === 'personas' && <PeoplePanel executors={executors} auditors={auditors} />}
          {section === 'detalle' && <DetailPanel rows={visibleDetails} total={details.length} search={detailSearch} onSearch={setDetailSearch} />}
          <section className="next"><div><span>N2 · RECOMENDACIÓN</span><h2>{current.unclassifiedResults ? 'Convierta recurrencia sin clasificar en conocimiento humano.' : current.operationalIssues ? 'Ataque la causa repetida con mayor alcance.' : 'Mantenga vigilancia por excepción.'}</h2></div><p>Impacto esperado: disminuir reincidencia sin confundir calidad de evidencia, clasificación y cumplimiento operacional.</p></section>
        </>}
    <footer><span>Generado {new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(data.generatedAt))}</span><span>{context.timezone}</span></footer>
  </main>
}

function LocationsPanel({ locations, categories, sublocations, locationCategoryMap, maximum }: { locations: Array<import('./types').Location & { tenantId: string; tenantName: string }>; categories: string[]; sublocations: Record<string, unknown>[]; locationCategoryMap: Map<string, Record<string, unknown>>; maximum: number }) {
  return <>
    <div className="location-card-grid">{locations.map((row, index) => <article className="smart-card location-card" key={`${row.tenantId}-${row.locationId}-${index}`}><div><span>UBICACION · {row.tenantName}</span><strong>{row.locationName}</strong><small>{row.resultCount.toLocaleString('es-MX')} resultados · {row.taskCount} tareas</small></div><b className={(row.complianceRate ?? 0) >= 80 ? 'good' : 'warn'}>{number(row.complianceRate, 1)}%</b><i><span style={{ width: `${Math.min(100, row.complianceRate ?? 0)}%` }} /></i><p>{row.nonComplianceResults} fallas · {number(row.evidenceFailureRate, 1)}% evidencia fallida · principal: {resultLabel(row.topIssueCategory)}</p></article>)}</div>
    <section className="smart-card"><div className="section-heading"><div><span>MATRIZ DE CAUSAS</span><h2>Resultado por ubicacion</h2></div><small>Intensidad relativa al maximo visible</small></div><div className="table-wrap"><table className="location-heatmap"><thead><tr><th>Ubicacion</th>{categories.map((category) => <th key={category}>{resultLabel(category)}</th>)}</tr></thead><tbody>{locations.map((location, index) => <tr key={`${location.tenantId}-${location.locationId}-${index}`}><td><strong>{location.locationName}</strong><span>{location.tenantName} · {location.resultCount} resultados</span></td>{categories.map((category) => { const row = locationCategoryMap.get(`${location.tenantId}|${location.locationId}|${category}`); const count = row ? rowNumber(row, 'ResultCount') : 0; return <td key={category}><span className="heat-cell" style={{ backgroundColor: category === 'CUMPLIMIENTO' ? `rgba(20,135,112,${.06 + count / maximum * .88})` : `rgba(216,75,69,${.05 + count / maximum * .78})` }}>{count}</span></td> })}</tr>)}</tbody></table></div></section>
    <section className="smart-card"><div className="section-heading"><div><span>SEGUNDA PROFUNDIDAD</span><h2>Salud operativa por sububicacion</h2></div><small>{sublocations.length} combinaciones</small></div><div className="table-wrap"><table><thead><tr><th>Tenant / ubicacion / sububicacion</th><th>Resultados</th><th>Tareas</th><th>Cumplimiento</th><th>Fallas</th><th>Evidencia fallida</th><th>Problemas de imagen</th><th>Ultima fecha</th></tr></thead><tbody>{sublocations.map((row, index) => <tr key={`${row.TenantId}-${row.LocationId}-${row.SublocationId}-${index}`}><td><strong>{rowText(row, 'TenantName')}</strong><span>{rowText(row, 'LocationName')} · {rowText(row, 'SublocationName')}</span></td><td>{rowNumber(row, 'ResultCount')}</td><td>{rowNumber(row, 'TaskCount')}</td><td><strong>{rowNumber(row, 'ComplianceRate').toFixed(1)}%</strong></td><td>{rowNumber(row, 'NonComplianceResults')}</td><td>{rowNumber(row, 'EvidenceFailureRate').toFixed(1)}%</td><td>{rowNumber(row, 'ImageQualityIssues')}</td><td>{rowText(row, 'LatestDate')}</td></tr>)}</tbody></table></div></section>
  </>
}

function TasksPanel({ priorities, categories, tasks, recurrent }: { priorities: Record<string, unknown>[]; categories: Record<string, unknown>[]; tasks: Record<string, unknown>[]; recurrent: Array<import('./types').RecurrentIssue & { tenantName: string }> }) {
  return <>
    <div className="priority-grid">{priorities.map((row, index) => <article className="smart-card" key={`${row.TenantId}-${row.Priority}-${index}`}><span>PRIORIDAD {rowText(row, 'Priority').toLocaleUpperCase('es-MX')}</span><strong>{rowNumber(row, 'ComplianceRate').toFixed(1)}%</strong><small>{rowNumber(row, 'NonComplianceResults')} fallas · {rowNumber(row, 'TaskCount')} tareas · {rowNumber(row, 'EvidenceFailureRate').toFixed(1)}% evidencia fallida</small></article>)}</div>
    <section className="smart-card"><div className="section-heading"><div><span>FAMILIAS OPERATIVAS</span><h2>Categorias de tarea</h2></div><small>{categories.length} categorias observadas</small></div><div className="table-wrap"><table><thead><tr><th>Tenant / categoria</th><th>Resultados</th><th>Tareas</th><th>Ubicaciones</th><th>Cumplimiento</th><th>Fallas</th><th>Evidencia fallida</th></tr></thead><tbody>{categories.map((row, index) => <tr key={`${row.TenantId}-${row.TaskCategory}-${index}`}><td><strong>{rowText(row, 'TaskCategory')}</strong><span>{rowText(row, 'TenantName')}</span></td><td>{rowNumber(row, 'ResultCount')}</td><td>{rowNumber(row, 'TaskCount')}</td><td>{rowNumber(row, 'LocationCount')}</td><td>{rowNumber(row, 'ComplianceRate').toFixed(1)}%</td><td>{rowNumber(row, 'NonComplianceResults')}</td><td>{rowNumber(row, 'EvidenceFailureRate').toFixed(1)}%</td></tr>)}</tbody></table></div></section>
    <section className="smart-card"><div className="section-heading"><div><span>PRIORIZACION</span><h2>Tareas con mayor carga de fallas</h2></div><small>Hasta 150 por tenant</small></div><div className="table-wrap"><table><thead><tr><th>Tenant / tarea / checkpoint</th><th>Categoria</th><th>Prioridad</th><th>Resultados</th><th>Ubicaciones</th><th>Cumplimiento</th><th>Fallas</th><th>Evidencia fallida</th><th>Causa principal</th><th>Ultima fecha</th></tr></thead><tbody>{tasks.map((row, index) => <tr key={`${row.TenantId}-${row.TaskId}-${row.CheckpointId}-${index}`}><td><strong>{rowText(row, 'TaskName')}</strong><span>{rowText(row, 'TenantName')} · {rowText(row, 'CheckpointName')}</span></td><td>{rowText(row, 'TaskCategory')}</td><td>{rowText(row, 'Priority')}</td><td>{rowNumber(row, 'ResultCount')}</td><td>{rowNumber(row, 'LocationCount')}</td><td>{rowNumber(row, 'ComplianceRate').toFixed(1)}%</td><td>{rowNumber(row, 'NonComplianceResults')}</td><td>{rowNumber(row, 'EvidenceFailureRate').toFixed(1)}%</td><td><b className="cause-pill">{resultLabel(rowText(row, 'TopIssueCategory', 'SIN_CLASIFICAR'))}</b></td><td>{rowText(row, 'LatestDate')}</td></tr>)}</tbody></table></div></section>
    <section className="recurrent"><div className="section-heading"><div><span>RECURRENCIA</span><h2>Combinaciones operativas que se repiten</h2></div><small>Al menos dos resultados</small></div><div className="table-wrap"><table><thead><tr><th>Tenant / ubicacion</th><th>Tarea</th><th>Causa</th><th>Recurrencias</th><th>Planes</th><th>Evidencia fallida</th><th>Ventana</th></tr></thead><tbody>{recurrent.map((row, index) => <tr key={`${row.tenantName}-${row.locationId}-${row.taskId}-${index}`}><td><strong>{row.tenantName}</strong><span>{row.locationName} · {row.sublocationName}</span></td><td>{row.taskName}</td><td><b className="cause-pill">{resultLabel(row.resultCategory)}</b></td><td>{row.recurrenceCount}</td><td>{row.workPlanCount}</td><td>{row.failedEvidenceCount}</td><td>{row.firstDate}<span>a {row.lastDate}</span></td></tr>)}</tbody></table></div></section>
  </>
}

function ClassificationPanel({ methods, categories, methodCategories, models, quality }: { methods: Record<string, unknown>[]; categories: string[]; methodCategories: Record<string, unknown>[]; models: Record<string, unknown>[]; quality: Record<string, number> }) {
  return <>
    <section className="classification-flow"><div><span>1</span><strong>Cumplimiento IA</strong><small>RULE · confianza 1.0</small></div><i>→</i><div><span>2</span><strong>Lookup humano</strong><small>HUMAN · confianza aprobada</small></div><i>→</i><div><span>3</span><strong>Reglas</strong><small>Patrones deterministas</small></div><i>→</i><div><span>4</span><strong>Modelo</strong><small>Solo sobre umbral</small></div><i>→</i><div><span>5</span><strong>Sin clasificar</strong><small>Se envia a revision</small></div></section>
    <div className="method-grid">{methods.map((row, index) => <article className="smart-card" key={`${row.TenantId}-${row.ClassificationMethod}-${index}`}><span>{rowText(row, 'ClassificationMethod')}</span><strong>{rowNumber(row, 'ResultCount').toLocaleString('es-MX')}</strong><small>{rowNumber(row, 'NonComplianceResults')} fallas · confianza media {(rowNumber(row, 'AvgConfidence') * 100).toFixed(1)}% · {rowNumber(row, 'ModelCount')} modelos</small></article>)}</div>
    <div className="split"><section className="smart-card"><div className="section-heading"><div><span>COBERTURA</span><h2>Metodo por categoria final</h2></div><small>Resultados observados</small></div><div className="table-wrap"><table><thead><tr><th>Tenant / metodo</th>{categories.map((category) => <th key={category}>{resultLabel(category)}</th>)}</tr></thead><tbody>{methods.map((method, index) => <tr key={`${method.TenantId}-${method.ClassificationMethod}-${index}`}><td><strong>{rowText(method, 'ClassificationMethod')}</strong><span>{rowText(method, 'TenantName')}</span></td>{categories.map((category) => { const row = methodCategories.find((item) => item.TenantId === method.TenantId && item.ClassificationMethod === method.ClassificationMethod && item.ResultCategory === category); return <td key={category}>{row ? rowNumber(row, 'ResultCount') : 0}</td> })}</tr>)}</tbody></table></div></section><section className="smart-card"><div className="section-heading"><div><span>TRAZABILIDAD</span><h2>Versiones observadas</h2></div><small>Modelo y metodo</small></div><div className="table-wrap"><table><thead><tr><th>Tenant / version</th><th>Metodo</th><th>Resultados</th><th>Categorias</th><th>Confianza</th><th>Vigencia</th></tr></thead><tbody>{models.map((row, index) => <tr key={`${row.TenantId}-${row.ClassifierModelVersion}-${row.ClassificationMethod}-${index}`}><td><strong>{rowText(row, 'ClassifierModelVersion')}</strong><span>{rowText(row, 'TenantName')}</span></td><td>{rowText(row, 'ClassificationMethod')}</td><td>{rowNumber(row, 'ResultCount')}</td><td>{rowNumber(row, 'CategoryCount')}</td><td>{(rowNumber(row, 'AvgConfidence') * 100).toFixed(1)}%<span>{(rowNumber(row, 'MinConfidence') * 100).toFixed(1)}–{(rowNumber(row, 'MaxConfidence') * 100).toFixed(1)}%</span></td><td>{rowText(row, 'FirstDate')}<span>a {rowText(row, 'LastDate')}</span></td></tr>)}</tbody></table></div></section></div>
    <section className="smart-card"><div className="section-heading"><div><span>CONTRATO Y CALIDAD</span><h2>Integridad observable de la tabla</h2></div><small>No se imputan valores faltantes</small></div><div className="quality-grid">{Object.entries({ MissingLocationId: 'Ubicacion sin ID', MissingLocationName: 'Ubicacion sin nombre', MissingSublocationId: 'Sububicacion sin ID', MissingSublocationName: 'Sububicacion sin nombre', MissingTaskId: 'Tarea sin ID', MissingTaskName: 'Tarea sin nombre', MissingExecutorName: 'Ejecutor sin nombre', MissingAuditorName: 'Auditor sin nombre', MissingTaskCategory: 'Sin categoria de tarea', MissingPriority: 'Sin prioridad', MissingAiResult: 'AiResult ausente', MissingReviewAiDate: 'ReviewAIDate ausente', ResultsWithoutEvidence: 'Sin evidencia', UnclassifiedResults: 'Sin clasificar', MissingClassifierConfidence: 'Confianza ausente', NegativeReviewLatency: 'Brecha temporal negativa', ResultMismatch: 'Resultado inconsistente' }).map(([field, label]) => <div key={field} className={quality[field] ? 'attention' : 'healthy'}><span>{label}</span><strong>{(quality[field] ?? 0).toLocaleString('es-MX')}</strong></div>)}</div></section>
  </>
}

function PeoplePanel({ executors, auditors }: { executors: Record<string, unknown>[]; auditors: Record<string, unknown>[] }) {
  const table = (rows: Record<string, unknown>[], field: string) => <div className="table-wrap"><table><thead><tr><th>Tenant / persona</th><th>Resultados</th><th>Ubicaciones</th><th>Cumplimiento</th><th>Fallas</th><th>Evidencias</th><th>Evidencia fallida</th><th>Ultima fecha</th></tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.TenantId}-${row[field]}-${index}`}><td><strong>{rowText(row, field)}</strong><span>{rowText(row, 'TenantName')}</span></td><td>{rowNumber(row, 'ResultCount')}</td><td>{rowNumber(row, 'LocationCount')}</td><td>{rowNumber(row, 'ComplianceRate').toFixed(1)}%</td><td>{rowNumber(row, 'NonComplianceResults')}</td><td>{rowNumber(row, 'EvidenceCount')}</td><td>{rowNumber(row, 'EvidenceFailureRate').toFixed(1)}%</td><td>{rowText(row, 'LatestDate')}</td></tr>)}</tbody></table></div>
  return <div className="split"><section className="smart-card"><div className="section-heading"><div><span>EJECUCION</span><h2>Resultados asociados por ejecutor</h2></div><small>{executors.length} personas</small></div>{table(executors, 'ExecutorName')}</section><section className="smart-card"><div className="section-heading"><div><span>VALIDACION</span><h2>Resultados asociados por auditor</h2></div><small>{auditors.length} personas</small></div>{table(auditors, 'AuditorName')}</section></div>
}

function DetailPanel({ rows, total, search, onSearch }: { rows: Record<string, unknown>[]; total: number; search: string; onSearch: (value: string) => void }) {
  return <section className="smart-card detail-panel"><div className="section-heading"><div><span>GRANO PLANRESULTID</span><h2>Detalle auditable de resultados</h2></div><small>Hasta 500 filas por tenant</small></div><div className="detail-search"><label><span>Buscar en todas las columnas</span><input type="search" value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Ubicacion, tarea, persona, categoria, ID..." /></label><strong>{rows.length} de {total}</strong></div><div className="table-wrap"><table className="detail-table"><thead><tr><th>Fecha / ubicacion</th><th>Tarea / checkpoint</th><th>Ejecutor / auditor</th><th>Categoria / prioridad</th><th>Resultado IA</th><th>Evidencias</th><th>Clasificacion</th><th>Identificadores</th><th>Fechas tecnicas</th></tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.TenantId}-${row.PlanResultId}-${index}`}><td><strong>{rowText(row, 'ReviewAIDate', 'Sin ReviewAIDate')}</strong><span>{rowText(row, 'TenantName')} · {rowText(row, 'LocationName', 'Sin ubicacion')}</span><span>{rowText(row, 'SublocationName', 'Sin sububicacion')}</span></td><td><strong>{rowText(row, 'TaskName', 'Sin tarea')}</strong><span>{rowText(row, 'CheckpointName', 'Sin checkpoint')}</span></td><td><strong>{rowText(row, 'ExecutorName', 'Sin ejecutor')}</strong><span>{rowText(row, 'AuditorName', 'Sin auditor')}</span></td><td><strong>{rowText(row, 'TaskCategory')}</strong><span>{rowText(row, 'Priority')}</span></td><td><b className="cause-pill">{resultLabel(rowText(row, 'ResultCategory', 'SIN_CLASIFICAR'))}</b><span>{row.AiResult === true || rowNumber(row, 'AiResult') === 1 ? 'AiResult aprobado' : row.AiResult === false || rowNumber(row, 'AiResult') === 0 ? 'AiResult no aprobado' : 'AiResult ausente'}</span></td><td><strong>{rowNumber(row, 'FailedEvidenceCount')} / {rowNumber(row, 'EvidenceCount')}</strong><span>{rowNumber(row, 'EvidenceFailureRate').toFixed(1)}% fallida</span><span>Foto {rowText(row, 'EvidencePhotoId')}</span></td><td><strong>{rowText(row, 'ClassificationMethod')}</strong><span>{(rowNumber(row, 'ClassifierConfidence') * 100).toFixed(1)}% · {rowText(row, 'ClassifierModelVersion', 'sin modelo')}</span></td><td><strong>Resultado {rowText(row, 'PlanResultId')}</strong><span>Plan {rowText(row, 'WorkPlanId')}</span><span>Tarea {rowText(row, 'TaskId')} · checkpoint {rowText(row, 'CheckpointId')}</span></td><td><strong>Revision {rowText(row, 'ReviewDate')}</strong><span>IA {rowText(row, 'ReviewAIDate')}</span><span>Cambio fuente {rowText(row, 'SourceLastChangedAt')}</span><span>Creado {rowText(row, 'CreatedAt')} · modificado {rowText(row, 'ModifiedAt')}</span><span>Brecha {rowNumber(row, 'ReviewLatencyMinutes').toFixed(1)} min</span></td></tr>)}</tbody></table></div></section>
}

function TenantRow({ tenant }: { tenant: TenantResult }) {
  if (tenant.coverageStatus !== 'AVAILABLE') return <article className="tenant unavailable"><div><strong>{tenant.tenantName}</strong><span>{coverageLabel(tenant.coverageStatus)}</span></div><p>{tenant.coverageStatus === 'NO_DATA' ? 'El fact existe sin resultados en el periodo.' : tenant.coverageStatus === 'NOT_SUPPORTED' ? 'El fact SmartAudits no existe para este tenant.' : 'La conexión o consulta no está disponible.'}</p></article>
  return <article className="tenant"><div><strong>{tenant.tenantName}</strong><span>Disponible</span></div><div><span>Cumplimiento <b>{number(tenant.current.complianceRate, 1)}%</b></span><span>Resultados <b>{tenant.current.resultCount}</b></span><span>Fallas <b>{tenant.current.nonComplianceResults}</b></span><span>Sin clasificar <b>{tenant.current.unclassifiedResults}</b></span></div><i><b style={{ width: `${Math.max(0, Math.min(tenant.current.complianceRate ?? 0, 100))}%` }} /></i></article>
}
