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
  await expect(page.getByText('Frescura · Viva').first()).toBeVisible()
  await expect(page.getByText('Scope · 7 tenants').first()).toBeVisible()
  await expect(page.getByText('Clearance · Académico privado').first()).toBeVisible()
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
