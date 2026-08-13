import { expect, test } from '@playwright/test'

test('keeps missing reading coverage distinct from zero', async ({ page }) => {
  await page.route('**/api/module/manifest', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ protocolVersion: '1.0', moduleId: 'lecturas', releaseStage: 'DEVELOPMENT', dataEnvironment: 'STAGE', freshnessMode: 'LIVE', clearance: 'ACADEMIC_PRIVATE', tenantScope: 'ALL_TENANTS' }) }))
  await page.route('**/api/readings**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ generatedAt: '2026-08-12T18:00:00Z', from: '2026-07-12', to: '2026-08-12', tenants: [row('Carls Jr', 'AVAILABLE', 3, 1), row('Emerson', 'NO_DATA', 0, 0), row('Valle del Encino', 'NOT_SUPPORTED', 0, 0)] }) }))
  await page.goto('/')
  await expect(page.getByText('1 sensores estan desconectados.')).toBeVisible()
  await expect(page.getByText('La tabla existe sin filas en el periodo.')).toBeVisible()
  await expect(page.getByText('El fact de lecturas no existe.')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
})

function row(name: string, status: string, observed: number, disconnected: number) {
  const summary = { sensorsObserved: observed, healthySensors: observed - disconnected, disconnectedSensors: disconnected, lateSensors: 0, avgMinutesWithoutReadings: disconnected ? 60 : null, maxMinutesWithoutReadings: disconnected ? 60 : null, latestAuditAt: null, latestReadingAt: null }
  return { tenantId: name.toLowerCase(), tenantName: name, coverageStatus: status, missingSources: [], current: summary, previous: summary, exceptions: [], errorCode: null }
}
