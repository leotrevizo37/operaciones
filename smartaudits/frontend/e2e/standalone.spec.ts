import { expect, test } from '@playwright/test'

test('keeps the human review queue locked without a shell JWT', async ({ page }) => {
  await page.route('**/api/module/manifest', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ protocolVersion: '1.0', moduleId: 'smartaudits', releaseStage: 'DEVELOPMENT', dataEnvironment: 'PRODUCTION', freshnessMode: 'LIVE', clearance: 'ACADEMIC_PRIVATE', tenantScope: 'ALL_TENANTS' }) }))
  await page.route('**/api/smartaudits**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ generatedAt: '2026-08-12T18:00:00Z', from: '2026-07-12', to: '2026-08-12', tenants: [] }) }))
  await page.goto('/')
  await page.getByRole('button', { name: 'Cola de revisión' }).click()
  await expect(page.getByText('La cola requiere identidad del shell')).toBeVisible()
  await expect(page.getByText('Cola humana · Carls Jr')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
})

test('renders the six analytical SmartAudits sections', async ({ page }) => {
  await page.route('**/api/module/manifest', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ protocolVersion: '1.0', moduleId: 'smartaudits', releaseStage: 'PRODUCTION', dataEnvironment: 'PRODUCTION', freshnessMode: 'LIVE', clearance: 'ACADEMIC_PRIVATE', tenantScope: 'ALL_TENANTS' }) }))
  const summary = { resultCount: 12, workPlanCount: 4, locationCount: 1, taskCount: 2, complianceResults: 8, nonComplianceResults: 4, complianceRate: 66.7, evidenceCount: 18, failedEvidenceCount: 5, evidenceFailureRate: 27.8, unclassifiedResults: 1, classificationCoverageRate: 91.7, imageQualityIssues: 1, operationalIssues: 2, avgClassifierConfidence: .87, avgReviewLatencyMinutes: 120, latestSourceChangedAt: '2026-08-12T15:00:00Z', latestModifiedAt: '2026-08-12T16:00:00Z' }
  const location = { locationId: 'location-1', locationName: 'Sucursal Centro', resultCount: 12, taskCount: 2, nonComplianceResults: 4, complianceRate: 66.7, evidenceFailureRate: 27.8, imageQualityIssues: 1, unclassifiedResults: 1, topIssueCategory: 'INCUMPLIMIENTO_LIMPIEZA', topIssueCount: 2 }
  const recurrent = { locationId: 'location-1', locationName: 'Sucursal Centro', sublocationId: 'sub-1', sublocationName: 'Cocina', taskId: 'task-1', taskName: 'Validar limpieza', resultCategory: 'INCUMPLIMIENTO_LIMPIEZA', recurrenceCount: 2, workPlanCount: 2, failedEvidenceCount: 2, firstDate: '2026-08-11', lastDate: '2026-08-12' }
  const tenant = { tenantId: 'carlsjr', tenantName: 'Carls Jr', coverageStatus: 'AVAILABLE', missingSources: [], current: summary, previous: summary, categories: [{ resultCategory: 'CUMPLIMIENTO', resultCount: 8, resultShare: 66.7, locationCount: 1, taskCount: 2, avgClassifierConfidence: 1 }, { resultCategory: 'INCUMPLIMIENTO_LIMPIEZA', resultCount: 4, resultShare: 33.3, locationCount: 1, taskCount: 1, avgClassifierConfidence: .8 }], locations: [location], recurrentIssues: [recurrent], daily: [{ MetricDate: '2026-08-11', ResultCount: 5, ComplianceRate: 80, EvidenceFailureRate: 10 }, { MetricDate: '2026-08-12', ResultCount: 7, ComplianceRate: 57.1, EvidenceFailureRate: 40 }], sublocations: [{ LocationId: 'location-1', LocationName: 'Sucursal Centro', SublocationId: 'sub-1', SublocationName: 'Cocina', ResultCount: 12, TaskCount: 2, ComplianceRate: 66.7, NonComplianceResults: 4, EvidenceFailureRate: 27.8, ImageQualityIssues: 1, LatestDate: '2026-08-12' }], locationCategories: [{ LocationId: 'location-1', ResultCategory: 'CUMPLIMIENTO', ResultCount: 8 }, { LocationId: 'location-1', ResultCategory: 'INCUMPLIMIENTO_LIMPIEZA', ResultCount: 4 }], taskCategories: [{ TaskCategory: 'LIMPIEZA', ResultCount: 12, TaskCount: 2, LocationCount: 1, ComplianceRate: 66.7, NonComplianceResults: 4, EvidenceFailureRate: 27.8 }], priorities: [{ Priority: 'ALTA', ResultCount: 12, TaskCount: 2, ComplianceRate: 66.7, NonComplianceResults: 4, EvidenceFailureRate: 27.8 }], tasks: [{ TaskId: 'task-1', TaskName: 'Validar limpieza', CheckpointId: 'checkpoint-1', CheckpointName: 'Estacion principal', TaskCategory: 'LIMPIEZA', Priority: 'ALTA', ResultCount: 8, LocationCount: 1, ComplianceRate: 50, NonComplianceResults: 4, EvidenceFailureRate: 40, TopIssueCategory: 'INCUMPLIMIENTO_LIMPIEZA', LatestDate: '2026-08-12' }], methods: [{ ClassificationMethod: 'RULE', ResultCount: 8, NonComplianceResults: 0, AvgConfidence: 1, ModelCount: 0 }, { ClassificationMethod: 'HUMAN', ResultCount: 4, NonComplianceResults: 4, AvgConfidence: 1, ModelCount: 0 }], methodCategories: [{ ClassificationMethod: 'RULE', ResultCategory: 'CUMPLIMIENTO', ResultCount: 8 }, { ClassificationMethod: 'HUMAN', ResultCategory: 'INCUMPLIMIENTO_LIMPIEZA', ResultCount: 4 }], models: [{ ClassifierModelVersion: 'SIN_MODELO', ClassificationMethod: 'HUMAN', ResultCount: 4, CategoryCount: 1, AvgConfidence: 1, MinConfidence: 1, MaxConfidence: 1, FirstDate: '2026-08-11', LastDate: '2026-08-12' }], executors: [{ ExecutorName: 'Gerente Centro', ResultCount: 12, LocationCount: 1, ComplianceRate: 66.7, NonComplianceResults: 4, EvidenceCount: 18, EvidenceFailureRate: 27.8, LatestDate: '2026-08-12' }], auditors: [{ AuditorName: 'Auditor Regional', ResultCount: 12, LocationCount: 1, ComplianceRate: 66.7, NonComplianceResults: 4, EvidenceCount: 18, EvidenceFailureRate: 27.8, LatestDate: '2026-08-12' }], dataQuality: { MissingLocationId: 0, MissingTaskName: 0, ResultsWithoutEvidence: 0, UnclassifiedResults: 1 }, details: [{ PlanResultId: 1001, WorkPlanId: 500, EvidencePhotoId: 700, LocationId: 'location-1', SublocationId: 'sub-1', CheckpointId: 'checkpoint-1', TaskId: 'task-1', LocationName: 'Sucursal Centro', SublocationName: 'Cocina', CheckpointName: 'Estacion principal', TaskName: 'Validar limpieza', ExecutorName: 'Gerente Centro', AuditorName: 'Auditor Regional', TaskCategory: 'LIMPIEZA', Priority: 'ALTA', ResultCategory: 'INCUMPLIMIENTO_LIMPIEZA', AiResult: 0, ReviewDate: '2026-08-12T10:00:00', ReviewAIDate: '2026-08-12T12:00:00', ClassificationMethod: 'HUMAN', ClassifierConfidence: 1, FailedEvidenceCount: 2, EvidenceCount: 3, EvidenceFailureRate: 66.7, ReviewLatencyMinutes: 120, ModifiedAt: '2026-08-12T16:00:00' }], errorCode: null }
  await page.route('**/api/smartaudits**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ generatedAt: '2026-08-12T18:00:00Z', from: '2026-08-11', to: '2026-08-12', tenants: [tenant] }) }))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Composición de resultados' })).toBeVisible()
  await page.getByRole('button', { name: 'Sucursales' }).click()
  await expect(page.getByRole('heading', { name: 'Resultado por ubicacion' })).toBeVisible()
  await page.getByRole('button', { name: 'Tareas y recurrencia' }).click()
  await expect(page.getByRole('heading', { name: 'Tareas con mayor carga de fallas' })).toBeVisible()
  await page.getByRole('button', { name: 'Clasificación' }).click()
  await expect(page.getByRole('heading', { name: 'Metodo por categoria final' })).toBeVisible()
  await page.getByRole('button', { name: 'Personas' }).click()
  await expect(page.getByRole('heading', { name: 'Resultados asociados por ejecutor' })).toBeVisible()
  await page.getByRole('button', { name: 'Detalle' }).click()
  await expect(page.getByRole('heading', { name: 'Detalle auditable de resultados' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
})

test('approves one review through the web component with the exact client contract', async ({ page }) => {
  let approvalBody: Record<string, unknown> | null = null
  let approvalAuthorization = ''
  let queueLoads = 0
  await page.route('**/api/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.pathname === '/api/module/manifest') {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ protocolVersion: '1.0', moduleId: 'smartaudits', releaseStage: 'STAGE', dataEnvironment: 'PRODUCTION', freshnessMode: 'LIVE', clearance: 'ACADEMIC_PRIVATE', tenantScope: 'ALL_TENANTS' }) })
      return
    }
    if (url.pathname === '/api/smartaudits' && request.method() === 'GET') {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ generatedAt: '2026-08-12T18:00:00Z', from: '2026-07-12', to: '2026-08-12', tenants: [] }) })
      return
    }
    if (url.pathname === '/api/smartaudits/review-queue/approve') {
      approvalBody = request.postDataJSON() as Record<string, unknown>
      approvalAuthorization = request.headers().authorization ?? ''
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ reviewStatus: 'APPROVED', idempotent: false }) })
      return
    }
    if (url.pathname === '/api/smartaudits/review-queue') {
      queueLoads += 1
      const item = { normalizedCommentHash: 'a'.repeat(64), aiResult: 0, sampleComment: 'La estación presenta residuos visibles.', normalizedComment: 'la estacion presenta residuos visibles', candidateCount: 12, firstSeenAt: '2026-08-01T10:00:00Z', lastSeenAt: '2026-08-12T10:00:00Z', lastPlanResultId: 101, lastEvidencePhotoId: 202, suggestedCategory: 'SIN_CLASIFICAR', suggestedMethod: 'ML', suggestedConfidence: .62, reviewStatus: 'PENDING' }
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: queueLoads === 1 ? [item] : [], totalCount: queueLoads === 1 ? 1 : 0, page: 0, pageSize: 25 }) })
      return
    }
    await route.abort()
  })
  await page.goto('/')
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.type = 'module'
      script.src = '/remote-entry.js'
      script.addEventListener('load', () => resolve(), { once: true })
      script.addEventListener('error', () => reject(new Error('remote-entry.js failed to load')), { once: true })
      document.head.append(script)
    })
    document.body.replaceChildren()
    const element = document.createElement('duma-smartaudits-module') as HTMLElement & { setHostContext: (context: unknown) => void }
    document.body.append(element)
    element.setHostContext({
      protocolVersion: '1.0',
      moduleId: 'smartaudits',
      locale: 'es-MX',
      timezone: 'America/Mexico_City',
      tenantIds: ['carlsjr'],
      period: { from: '2026-07-12', to: '2026-08-12' },
      freshness: [],
      identity: { subject: 'reviewer-1', displayName: 'Revisor', roles: [], permissions: [], tenantScope: ['carlsjr'] },
      apiBaseUrl: '',
      auth: { getAccessToken: async () => 'module-token' },
      navigate: () => undefined,
    })
  })
  await page.getByRole('button', { name: 'Cola de revisión' }).click()
  await page.getByRole('button', { name: 'Revisar' }).click()
  const approve = page.getByRole('button', { name: 'Aprobar' })
  await expect(approve).toBeDisabled()
  await page.getByLabel('Categoría humana obligatoria').selectOption('INCUMPLIMIENTO_LIMPIEZA')
  await page.getByLabel('Nota opcional').fill('Validado contra la evidencia disponible.')
  await approve.click()
  await expect(page.getByRole('status')).toContainText('APPROVED')
  await expect(page.getByText('No hay filas PENDING')).toBeVisible()
  expect(approvalAuthorization).toBe('Bearer module-token')
  expect(approvalBody).toEqual({
    normalizedCommentHash: 'a'.repeat(64),
    aiResult: 0,
    resultCategory: 'INCUMPLIMIENTO_LIMPIEZA',
    reviewNotes: 'Validado contra la evidencia disponible.',
  })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
})
