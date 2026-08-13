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

test('promotes one review through the web component with the exact client contract', async ({ page }) => {
  let promotionBody: Record<string, unknown> | null = null
  let promotionAuthorization = ''
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
    if (url.pathname === '/api/smartaudits/review-queue/promote') {
      promotionBody = request.postDataJSON() as Record<string, unknown>
      promotionAuthorization = request.headers().authorization ?? ''
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ reviewStatus: 'PROMOTED', classificationMethod: 'HUMAN', classifierConfidence: 1, idempotent: false }) })
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
      identity: { subject: 'reviewer-1', displayName: 'Revisor', roles: [], permissions: [], tenantScope: ['carlsjr'] },
      apiBaseUrl: '',
      auth: { getAccessToken: async () => 'module-token' },
      navigate: () => undefined,
    })
  })
  await page.getByRole('button', { name: 'Cola de revisión' }).click()
  await page.getByRole('button', { name: 'Revisar' }).click()
  const promote = page.getByRole('button', { name: 'Aprobar y promover' })
  await expect(promote).toBeDisabled()
  await page.getByLabel('Categoría humana obligatoria').selectOption('INCUMPLIMIENTO_LIMPIEZA')
  await page.getByLabel('Nota opcional').fill('Validado contra la evidencia disponible.')
  await promote.click()
  await expect(page.getByRole('status')).toContainText('PROMOTED')
  await expect(page.getByText('No hay filas PENDING')).toBeVisible()
  expect(promotionAuthorization).toBe('Bearer module-token')
  expect(promotionBody).toEqual({
    normalizedCommentHash: 'a'.repeat(64),
    aiResult: 0,
    resultCategory: 'INCUMPLIMIENTO_LIMPIEZA',
    reviewNotes: 'Validado contra la evidencia disponible.',
  })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
})
