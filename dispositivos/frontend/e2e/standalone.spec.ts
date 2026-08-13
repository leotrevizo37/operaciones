import { expect, test } from '@playwright/test'

test('renders device risk with scoring evidence', async ({ page }) => {
  await page.route('**/api/module/manifest', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ protocolVersion: '1.0', moduleId: 'dispositivos', releaseStage: 'PRODUCTION', dataEnvironment: 'PRODUCTION', freshnessMode: 'LIVE', clearance: 'ACADEMIC_PRIVATE', tenantScope: 'ALL_TENANTS' }) }))
  const summary = { devicesObserved: 1, avgHealthScore: 42, attentionDevices: 1, criticalDevices: 1, degradingDevices: 1, avgFailureRiskScore: .91, avgConfidenceScore: .88, latestDate: '2026-08-12', latestModifiedAt: '2026-08-12T18:00:00Z' }
  const device = { deviceId: 'd1', locationId: 'l1', subLocationId: null, deviceName: 'Cuarto frío principal', deviceType: 'Cuarto frío', equipmentKind: 'CUARTO_FRIO', localDate: '2026-08-12', healthScore: 42, operationalState: 'CRITICAL', worstHourlyState: 'CRITICAL', criticalHours: 2, degradedHours: 1, watchHours: 0, sevenDayHealthScore: 60, thirtyDayHealthScore: 70, trendDirection: 'DEGRADING', confidenceScore: .88, failureRiskScore: .91, dominantReasonCode: 'FAILURE_RISK', recommendedAction: 'Inspeccionar equipo', evidenceJson: '{}', featureSetVersion: 'v1', scoringVersion: 'score-v1', modelVersion: null, modifiedAt: '2026-08-12T18:00:00Z' }
  await page.route('**/api/devices**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ generatedAt: '2026-08-12T18:00:00Z', from: '2026-07-12', to: '2026-08-12', tenants: [{ tenantId: 'carlsjr', tenantName: 'Carls Jr', coverageStatus: 'AVAILABLE', missingSources: [], current: summary, previous: summary, devices: [device], errorCode: null }] }) }))
  await page.goto('/')
  await expect(page.getByText('1 dispositivos están en estado crítico.')).toBeVisible()
  await expect(page.getByText('score-v1')).toBeVisible()
  await expect(page.getByText('Cuarto frío', { exact: true }).first()).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
})
