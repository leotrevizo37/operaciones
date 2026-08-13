import type { Manifest } from './types'

export function DataBadges({ manifest }: { manifest: Manifest }) {
  return (
    <div className="data-badges" aria-label="Clasificacion del modulo y sus datos">
      <span>Modulo · {manifest.releaseStage}</span>
      <span>Datos · {manifest.dataEnvironment} / {manifest.freshnessMode}</span>
      <span>Alcance · 7 tenants</span>
      <span>Clearance · {manifest.clearance}</span>
    </div>
  )
}
