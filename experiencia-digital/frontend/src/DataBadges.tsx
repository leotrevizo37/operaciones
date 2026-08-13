import type { Manifest } from './types'

export function DataBadges({ manifest }: { manifest: Manifest }) {
  return (
    <div className="data-badges" aria-label="Clasificacion del modulo y sus datos">
      <span className={`release-${manifest.releaseStage.toLowerCase()}`}>Modulo · {manifest.releaseStage}</span>
      <span className={`data-${manifest.dataEnvironment.toLowerCase()}`}>Datos · {manifest.dataEnvironment}</span>
    </div>
  )
}
