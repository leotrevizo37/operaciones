import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ModuleBadge, ModuleStatusBadges } from './ModuleBadge'

describe('ModuleBadge', () => {
  it('distingue la etapa de liberacion del modulo', () => {
    render(<ModuleBadge stage="TESTING" />)
    expect(screen.getByText('Pruebas')).toHaveClass('release-testing')
  })

  it('mantiene separadas liberacion, entorno, frescura, alcance y clearance', () => {
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
    expect(screen.getByText('Datos · Producción')).toBeInTheDocument()
    expect(screen.getByText('Frescura · Viva')).toBeInTheDocument()
    expect(screen.getByText('Scope · 7 tenants')).toBeInTheDocument()
    expect(screen.getByText('Clearance · Académico privado')).toBeInTheDocument()
  })
})
