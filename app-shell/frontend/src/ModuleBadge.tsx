import type { ModuleRegistration, ReleaseStage } from './types'

const releaseLabels: Record<ReleaseStage, string> = {
  DEVELOPMENT: 'Desarrollo',
  TESTING: 'Pruebas',
  STAGING: 'Stage',
  PRODUCTION: 'Produccion',
}

export function ModuleBadge({ stage }: { stage: ReleaseStage }) {
  return <span className={`release-badge release-${stage.toLowerCase()}`}>{releaseLabels[stage]}</span>
}

const dataEnvironmentLabels = {
  DEVELOPMENT: 'Desarrollo',
  TEST: 'Pruebas',
  STAGE: 'Stage',
  PRODUCTION: 'Producción',
} as const

const freshnessLabels = { LIVE: 'Viva', SNAPSHOT: 'Corte', MOCK: 'Mock' } as const
const scopeLabels = { ALL_TENANTS: '7 tenants', SELECTED_TENANTS: 'Tenants seleccionados', CARLSJR_ONLY: 'Carls Jr' } as const
const clearanceLabels = { ACADEMIC_PRIVATE: 'Académico privado', INTERNAL: 'Interno', RESTRICTED: 'Restringido' } as const

export function ModuleStatusBadges({ module }: { module: ModuleRegistration }) {
  return (
    <span className="module-badges" aria-label={`Estado de ${module.displayName}`}>
      <ModuleBadge stage={module.releaseStage} />
      <span className="status-badge">Datos · {dataEnvironmentLabels[module.dataEnvironment]}</span>
      <span className="status-badge">Frescura · {freshnessLabels[module.freshnessMode]}</span>
      <span className="status-badge">Scope · {scopeLabels[module.tenantScope]}</span>
      <span className="status-badge">Clearance · {clearanceLabels[module.clearance]}</span>
    </span>
  )
}
