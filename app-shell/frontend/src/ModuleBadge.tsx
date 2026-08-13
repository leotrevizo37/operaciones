import type { ModuleRegistration, ReleaseStage } from './types'

const releaseLabels: Record<ReleaseStage, string> = {
  DEVELOPMENT: 'Desarrollo',
  TESTING: 'Pruebas',
  STAGING: 'Stage',
  PRODUCTION: 'Producci\u00f3n',
}

const dataEnvironmentLabels = {
  DEVELOPMENT: 'Desarrollo',
  TEST: 'Pruebas',
  STAGE: 'Stage',
  PRODUCTION: 'Producci\u00f3n',
} as const

export function ModuleBadge({ stage }: { stage: ReleaseStage }) {
  return <span className={`release-badge release-${stage.toLowerCase()}`}>{releaseLabels[stage]}</span>
}

export function ModuleStatusBadges({ module, connected }: { module: ModuleRegistration; connected?: boolean }) {
  return (
    <span className="module-badges" aria-label={`Estado de ${module.displayName}`}>
      <ModuleBadge stage={module.releaseStage} />
      <span className={`status-badge data-${module.dataEnvironment.toLowerCase()}`}>Datos &middot; {dataEnvironmentLabels[module.dataEnvironment]}</span>
      {connected === false && <span className="status-badge freshness-failed">Base de datos no disponible</span>}
    </span>
  )
}
