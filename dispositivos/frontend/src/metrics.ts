import type { EquipmentKind, TenantResult } from './types'

type WeightedField = 'avgHealthScore' | 'avgFailureRiskScore' | 'avgConfidenceScore'

export function weightedMetric(
  tenants: TenantResult[],
  field: WeightedField,
  previous = false,
) {
  const values = tenants
    .map((tenant) => previous ? tenant.previous : tenant.current)
    .filter((summary) => summary.devicesObserved > 0 && summary[field] != null)
  const observed = values.reduce((sum, summary) => sum + summary.devicesObserved, 0)
  if (!observed) return null
  return values.reduce((sum, summary) => sum + summary[field]! * summary.devicesObserved, 0) / observed
}

export function delta(current: number | null, previous: number | null) {
  return current == null || previous == null ? null : current - previous
}

export function equipmentLabel(kind: EquipmentKind) {
  return {
    CUARTO_FRIO: 'Cuarto frío',
    HVAC: 'HVAC',
    BASCULA: 'Báscula',
    SEGURIDAD: 'Seguridad',
    NO_CLASIFICADO: 'Sin clasificar',
  }[kind]
}

export function coverageLabel(status: TenantResult['coverageStatus']) {
  return {
    AVAILABLE: 'Disponible',
    NO_DATA: 'Sin datos',
    NOT_SUPPORTED: 'Sin cobertura',
    UNAVAILABLE: 'No disponible',
  }[status]
}
