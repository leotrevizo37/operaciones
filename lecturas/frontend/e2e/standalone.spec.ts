import { expect, test } from '@playwright/test'

test('keeps missing reading coverage distinct from zero', async ({ page }) => {
  await page.route('**/api/module/manifest', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ protocolVersion: '1.0', moduleId: 'lecturas', releaseStage: 'DEVELOPMENT', dataEnvironment: 'STAGE', freshnessMode: 'LIVE', clearance: 'ACADEMIC_PRIVATE', tenantScope: 'ALL_TENANTS' }) }))
  await page.route('**/api/readings**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ generatedAt: '2026-08-12T18:00:00Z', from: '2026-07-12', to: '2026-08-12', tenants: [row('Carls Jr', 'AVAILABLE', 3, 1), row('Emerson', 'NO_DATA', 0, 0), row('Valle del Encino', 'NOT_SUPPORTED', 0, 0)] }) }))
  await page.goto('/')
  await expect(page.getByText('1 sensores estan desconectados.')).toBeVisible()
  await expect(page.locator('.metrics article').nth(0).locator('span')).toHaveText('Comunicación promedio')
  await expect(page.locator('.metrics article').nth(0).locator('strong')).toHaveText('50.0%')
  await expect(page.locator('.metrics article').nth(1).locator('span')).toHaveText('Sensores observados')
  await expect(page.locator('.metrics article').nth(1).locator('strong')).toHaveText('3')
  await expect(page.locator('.metrics article').nth(2).locator('span')).toHaveText('Continuidad actual')
  await expect(page.locator('.metrics article').nth(2).locator('strong')).toHaveText('66.7%')
  await expect(page.getByRole('heading', { name: 'Lecturas reportadas por sensor' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Lecturas totales por hora' })).toBeVisible()
  await page.locator('.chart-hit-area').first().hover()
  await expect(page.locator('.line-tooltip')).toContainText('Total: 0 lecturas')
  await expect(page.locator('.line-tooltip')).toContainText('Temperatura ambiente: 0')
  await expect(page.locator('.reading-point')).toHaveCount(0)
  expect(await page.locator('.hourly-panel').evaluate((panel) => { const tooltip = panel.querySelector('.line-tooltip')!.getBoundingClientRect(); const bounds = panel.getBoundingClientRect(); return tooltip.left >= bounds.left && tooltip.right <= bounds.right })).toBe(true)
  await expect(page.getByText('La tabla existe sin filas en el periodo.')).toBeVisible()
  await expect(page.getByText('El fact de lecturas no existe.')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth && Array.from(document.querySelectorAll('.metrics article')).every((card) => card.scrollWidth <= card.clientWidth + 1))).toBe(true)
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth && Array.from(document.querySelectorAll('.metrics article')).every((card) => card.scrollWidth <= card.clientWidth + 1))).toBe(true)
})

function row(name: string, status: string, observed: number, disconnected: number) {
  const summary = { sensorsObserved: observed, healthySensors: observed - disconnected, disconnectedSensors: disconnected, lateSensors: 0, avgMinutesWithoutReadings: disconnected ? 60 : null, maxMinutesWithoutReadings: disconnected ? 60 : null, latestAuditAt: null, latestReadingAt: null }
  const tenantId = name.toLowerCase().replace(/ /g, '-')
  return { tenantId, tenantName: name, coverageStatus: status, missingSources: [], current: summary, previous: summary, exceptions: [], hourly: status === 'AVAILABLE' ? [{ timeSpan: '2026-08-12T15:00:00Z', sensors: 3, avgReadings: 5, totalReadings: 15, lostSensors: 1, lateSensors: 0 }, { timeSpan: '2026-08-12T16:00:00Z', sensors: 3, avgReadings: 6, totalReadings: 18, lostSensors: 0, lateSensors: 0 }] : [], timeline: status === 'AVAILABLE' ? [{ sensorId: 'sensor-1', timeSpan: '2026-08-12T15:00:00Z', localTimeSpan: '2026-08-12T09:00:00', readingsCount: 0, late: false, disconnected: true, lastReadingAt: '2026-08-12T14:00:00Z', connectionLostAt: '2026-08-12T15:00:00Z', minutesWithoutReadings: 60 }, { sensorId: 'sensor-1', timeSpan: '2026-08-12T16:00:00Z', localTimeSpan: '2026-08-12T10:00:00', readingsCount: 6, late: false, disconnected: false, lastReadingAt: '2026-08-12T16:00:00Z', connectionLostAt: null, minutesWithoutReadings: 0 }] : [], sensors: status === 'AVAILABLE' ? [{ sensorId: 'sensor-1', locationName: 'Sucursal Centro', deviceName: 'Cuarto frio', sensorName: 'Temperatura ambiente', observedIntervals: 2, totalReadings: 6, avgReadings: 3, lostIntervals: 1, lateIntervals: 0, healthPercentage: 50, lastReadingAt: '2026-08-12T16:00:00Z', maxLossMinutes: 60 }] : [], errorCode: null }
}
