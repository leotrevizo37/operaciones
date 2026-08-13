import { expect, test } from '@playwright/test'

test('renders a seven-tenant mixed coverage story', async ({ page }) => {
  await page.route('**/api/module/manifest', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ protocolVersion: '1.0', moduleId: 'experiencia-digital', releaseStage: 'STAGE', dataEnvironment: 'PRODUCTION', freshnessMode: 'LIVE', clearance: 'ACADEMIC_PRIVATE', tenantScope: 'ALL_TENANTS' }) }))
  await page.route('**/api/experience**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ generatedAt: '2026-08-12T18:00:00Z', from: '2026-07-12', to: '2026-08-12', tenants: [tenant('carlsjr', 'Carls Jr', 'AVAILABLE'), tenant('emerson', 'Emerson', 'NO_DATA'), tenant('valledelencino', 'Valle del Encino', 'NOT_SUPPORTED'), tenant('mcdonalds', "McDonald's", 'UNAVAILABLE'), tenant('mcdonalds-cdp', "McDonald's CDP", 'NO_DATA'), tenant('smartfit', 'SmartFit', 'NO_DATA'), tenant('bafar-poc-gabinete', 'Bafar POC Gabinete', 'NO_DATA')] }) }))
  await page.goto('/')
  await expect(page.getByText('Modulo · STAGE')).toBeVisible()
  await expect(page.getByText('Cobertura parcial', { exact: true })).toBeVisible()
  await expect(page.getByText('Sin cobertura', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
})

function tenant(id: string, name: string, status: string) {
  const users = { evaluatedUserDays: status === 'AVAILABLE' ? 10 : 0, sessionUserDays: status === 'AVAILABLE' ? 8 : 0, completeInteractions: status === 'AVAILABLE' ? 7 : 0, avgSessionSeconds: status === 'AVAILABLE' ? 80 : null, avgLatencyMs: status === 'AVAILABLE' ? 250 : null, maxP95LatencyMs: status === 'AVAILABLE' ? 500 : null, slowUserDays: 0 }
  const availability = { observedServiceDays: status === 'AVAILABLE' ? 10 : 0, avgUptimePercentage: status === 'AVAILABLE' ? 99.5 : null, avgLatencySeconds: status === 'AVAILABLE' ? .2 : null, maxP95LatencySeconds: status === 'AVAILABLE' ? .5 : null, timeoutDays: 0, currentDownServices: 0, latestDate: status === 'AVAILABLE' ? '2026-08-12' : null }
  return { tenantId: id, tenantName: name, coverageStatus: status, missingSources: status === 'AVAILABLE' ? ['observability.factUrlAvailabilityDaily'] : [], current: { users, availability }, previous: { users, availability }, errorCode: status === 'UNAVAILABLE' ? 'TENANT_QUERY_FAILED' : null }
}
