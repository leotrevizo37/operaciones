import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ModuleBadge, ModuleStatusBadges } from './ModuleBadge'

describe('ModuleBadge', () => {
  it('distingue la etapa de liberacion del modulo', () => {
    render(<ModuleBadge stage="TESTING" />)
    expect(screen.getByText('Pruebas')).toHaveClass('release-testing')
  })

  it('muestra solo liberacion y entorno con semantica independiente', () => {
    render(<ModuleStatusBadges module={{
      moduleId: 'lecturas',
      displayName: 'Lecturas',
      customElement: 'duma-readings-module',
      remoteEntryUrl: 'http://localhost:8082/remote-entry.js',
      apiBaseUrl: 'http://localhost:8082',
      releaseStage: 'TESTING',
      dataEnvironment: 'PRODUCTION',
      freshnessMode: 'LIVE',
      clearance: 'ACADEMIC_PRIVATE',
      tenantScope: 'ALL_TENANTS',
      capabilities: ['dashboard'],
    }} />)
    expect(screen.getByText('Pruebas')).toBeInTheDocument()
    expect(screen.getByText('Datos · Producción')).toHaveClass('data-production')
    expect(screen.queryByText(/Frescura ·/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Clearance ·/)).not.toBeInTheDocument()
  })

  it('alarma cuando la base de datos no esta disponible', () => {
    render(<ModuleStatusBadges module={{
      moduleId: 'lecturas', displayName: 'Lecturas', customElement: 'duma-readings-module',
      remoteEntryUrl: '', apiBaseUrl: '', releaseStage: 'PRODUCTION', dataEnvironment: 'PRODUCTION',
      freshnessMode: 'LIVE', clearance: 'ACADEMIC_PRIVATE', tenantScope: 'ALL_TENANTS', capabilities: [],
    }} connected={false} />)
    expect(screen.getByText('Base de datos no disponible')).toHaveClass('freshness-failed')
  })
})
