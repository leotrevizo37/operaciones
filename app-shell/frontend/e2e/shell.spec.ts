import { expect, test } from '@playwright/test'

test('shows the authenticated shell boundary without horizontal overflow', async ({ page }) => {
  await page.route('**/api/auth/me', route => route.fulfill({ status: 401, body: '' }))
  await page.route('**/api/auth/csrf', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ token: 'test-csrf', headerName: 'X-XSRF-TOKEN' }),
  }))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'La operacion completa, sin perder el contexto.' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Entrar a Operaciones' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
})

test('shows module data badges and rejects an invalid module handshake', async ({ page }) => {
  await page.route('**/api/auth/csrf', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ token: 'test-csrf', headerName: 'X-XSRF-TOKEN' }),
  }))
  await page.route('**/api/auth/me', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ subject: 'researcher', displayName: 'Researcher', roles: [], permissions: [], tenantScope: [] }),
  }))
  await page.route('**/api/modules', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify([{
      moduleId: 'lecturas',
      displayName: 'Lecturas',
      customElement: 'duma-invalid-module',
      remoteEntryUrl: '/invalid-module.js',
      apiBaseUrl: 'http://localhost:8082',
      releaseStage: 'TESTING',
      dataEnvironment: 'PRODUCTION',
      freshnessMode: 'LIVE',
      clearance: 'ACADEMIC_PRIVATE',
      tenantScope: 'ALL_TENANTS',
      capabilities: ['dashboard'],
    }]),
  }))
  await page.route('**/invalid-module.js', route => route.fulfill({
    contentType: 'text/javascript',
    body: `customElements.define('duma-invalid-module', class extends HTMLElement { setHostContext() { this.dispatchEvent(new CustomEvent('duma:module-ready', { bubbles: true, composed: true, detail: { protocolVersion: '2.0', moduleId: 'lecturas', capabilities: ['dashboard'] } })) } })`,
  }))

  await page.goto('/')
  await expect(page.getByText('Datos · Producción').first()).toBeVisible()
  await expect(page.getByText('Base de datos no disponible').first()).toBeVisible()
  await expect(page.getByText('DECISIÓN GLOBAL', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Aplicar' })).toBeVisible()
  await expect(page.locator('.context-bar')).toContainText('Resumen ICOS')
  await page.getByRole('button', { name: 'Ocultar navegación' }).click()
  await expect(page.getByRole('button', { name: 'Mostrar navegación completa' })).toBeVisible()
  await expect(page.locator('.sidebar.collapsed .nav-icon').first()).toBeVisible()
  await page.getByRole('button', { name: /Lecturas/ }).first().click()
  await expect(page.getByText('No fue posible integrar este modulo')).toBeVisible()
})

test('mounts a compatible module with the complete host context', async ({ page }) => {
  await page.route('**/api/auth/csrf', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ token: 'test-csrf', headerName: 'X-XSRF-TOKEN' }),
  }))
  await page.route('**/api/auth/me', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ subject: 'researcher', displayName: 'Researcher', roles: ['RESEARCHER'], permissions: [], tenantScope: ['carlsjr'] }),
  }))
  await page.route('**/api/modules', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify([{
      moduleId: 'lecturas',
      displayName: 'Lecturas',
      customElement: 'duma-compatible-module',
      remoteEntryUrl: '/compatible-module.js',
      apiBaseUrl: 'http://localhost:8082',
      releaseStage: 'TESTING',
      dataEnvironment: 'PRODUCTION',
      freshnessMode: 'LIVE',
      clearance: 'ACADEMIC_PRIVATE',
      tenantScope: 'ALL_TENANTS',
      capabilities: ['dashboard'],
    }]),
  }))
  await page.route('**/compatible-module.js', route => route.fulfill({
    contentType: 'text/javascript',
    body: `customElements.define('duma-compatible-module', class extends HTMLElement { setHostContext(context) { window.__dumaHostContext = context; this.textContent = 'Modulo integrado'; this.dispatchEvent(new CustomEvent('duma:module-ready', { bubbles: true, composed: true, detail: { protocolVersion: '1.0', moduleId: 'lecturas', capabilities: ['dashboard'] } })) } })`,
  }))

  await page.goto('/')
  await page.getByRole('button', { name: /Lecturas/ }).first().click()
  await expect(page.getByText('Modulo integrado')).toBeVisible()
  const context = await page.evaluate(() => {
    const value = (window as unknown as { __dumaHostContext: { protocolVersion: string; moduleId: string; identity: { tenantScope: string[] }; apiBaseUrl: string } }).__dumaHostContext
    return { protocolVersion: value.protocolVersion, moduleId: value.moduleId, tenantScope: value.identity.tenantScope, apiBaseUrl: value.apiBaseUrl }
  })
  expect(context).toEqual({ protocolVersion: '1.0', moduleId: 'lecturas', tenantScope: ['carlsjr'], apiBaseUrl: 'http://localhost:8082' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
})

test('scores enabled tenant modules and maps ingestion status without overflow', async ({ page }) => {
  await page.route('**/api/auth/csrf', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ token: 'test-csrf', headerName: 'X-XSRF-TOKEN' }) }))
  await page.route('**/api/auth/me', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ subject: 'researcher', displayName: 'Researcher', roles: [], permissions: [], tenantScope: [] }) }))
  await page.route('**/api/modules', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify([
    ['lecturas', 'Lecturas'], ['smartaudits', 'SmartAudits'], ['dispositivos', 'Dispositivos'], ['experiencia-digital', 'Experiencia digital'],
  ].map(([moduleId, displayName]) => ({ moduleId, displayName, customElement: `duma-${moduleId}`, remoteEntryUrl: `/remote-${moduleId}.js`, apiBaseUrl: 'http://module.local', releaseStage: 'TESTING', dataEnvironment: 'PRODUCTION', freshnessMode: 'LIVE', clearance: 'ACADEMIC_PRIVATE', tenantScope: 'ALL_TENANTS', capabilities: ['dashboard'] }))) }))
  await page.route('**/api/integration/token', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ accessToken: 'test-token' }) }))
  const freshness = { tenants: [{ tenantId: 'emerson', tenantName: 'Emerson', ingestionName: 'test', lastRunStatus: 'SUCCEEDED', lastLoadedAt: '2026-08-17T18:00:00Z' }] }
  await page.route('**/api/readings/freshness**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(freshness) }))
  await page.route('**/api/smartaudits/freshness**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(freshness) }))
  await page.route('**/api/devices/freshness**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(freshness) }))
  await page.route('**/api/experience/freshness**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(freshness) }))
  await page.route('**/api/readings?*', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ tenants: [{ tenantId: 'emerson', tenantName: 'Emerson', coverageStatus: 'AVAILABLE', current: { sensorsObserved: 10, healthySensors: 9 }, sensors: [{ sensorId: 'sensor-1', locationName: 'Planta', deviceName: 'Equipo', sensorName: 'Temperatura', observedIntervals: 10, lostIntervals: 4 }] }] }) }))
  await page.route('**/api/smartaudits?*', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ tenants: [{ tenantId: 'emerson', tenantName: 'Emerson', coverageStatus: 'NOT_SUPPORTED', current: {}, locations: [] }] }) }))
  await page.route('**/api/devices?*', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ tenants: [{ tenantId: 'emerson', tenantName: 'Emerson', coverageStatus: 'AVAILABLE', current: { devicesObserved: 2, avgHealthScore: 80 }, devices: [] }] }) }))
  await page.route('**/api/experience?*', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ tenants: [{ tenantId: 'emerson', tenantName: 'Emerson', coverageStatus: 'AVAILABLE', current: { users: { sessionUserDays: 10, completeInteractions: 9 }, availability: { observedServiceDays: 10, avgUptimePercentage: 100 } } }] }) }))

  await page.goto('/')
  const tenantCard = page.locator('.tenant-summary-card').filter({ hasText: 'Emerson' })
  await expect(tenantCard.locator('.state-pill')).toHaveText('68.7%')
  await expect(tenantCard.locator('dd').nth(1)).toHaveText('No habilitado')
  await expect(page.locator('.ingestion-pill')).toHaveText('Ingesta · Exitoso')
  await expect(page.locator('.domain-card h2')).toHaveText(['Lecturas', 'SmartAudits', 'Dispositivos', 'Experiencia digital'])
  await expect(page.locator('.domain-card').first().locator('.domain-value')).toHaveText('60.0%')
  expect(await page.locator('.verdict-value strong').evaluate((value) => value.clientHeight <= Number.parseFloat(getComputedStyle(value).lineHeight) * 1.1)).toBe(true)
  await page.getByRole('button', { name: 'Cerrar insight' }).click()
  await expect(page.locator('.summary-insight')).toHaveCount(0)
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth && Array.from(document.querySelectorAll('.card')).every(card => card.scrollWidth <= card.clientWidth + 1))).toBe(true)
  expect(await page.locator('.verdict-value strong').evaluate((value) => value.clientHeight <= Number.parseFloat(getComputedStyle(value).lineHeight) * 1.1)).toBe(true)
})
