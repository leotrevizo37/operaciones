import type { PromotableCategory, TenantResult } from './types'

export const PROMOTABLE_CATEGORIES: PromotableCategory[] = [
  'IMAGEN_NO_PROCESABLE',
  'IMAGEN_NO_LEGIBLE',
  'FUERA_DE_RANGO',
  'INCUMPLIMIENTO_LIMPIEZA',
  'INCUMPLIMIENTO_GENERAL',
]

export function isPromotable(value: string | null): value is PromotableCategory {
  return value != null && PROMOTABLE_CATEGORIES.includes(value as PromotableCategory)
}

export function aggregate(tenants: TenantResult[], previous = false) {
  const summaries = tenants.map((tenant) => previous ? tenant.previous : tenant.current)
  const resultCount = summaries.reduce((sum, item) => sum + item.resultCount, 0)
  const complianceResults = summaries.reduce((sum, item) => sum + item.complianceResults, 0)
  const evidenceCount = summaries.reduce((sum, item) => sum + item.evidenceCount, 0)
  const failedEvidenceCount = summaries.reduce((sum, item) => sum + item.failedEvidenceCount, 0)
  return {
    resultCount,
    complianceRate: resultCount ? complianceResults / resultCount * 100 : null,
    evidenceFailureRate: evidenceCount ? failedEvidenceCount / evidenceCount * 100 : null,
    unclassifiedResults: summaries.reduce((sum, item) => sum + item.unclassifiedResults, 0),
    operationalIssues: summaries.reduce((sum, item) => sum + item.operationalIssues, 0),
    imageQualityIssues: summaries.reduce((sum, item) => sum + item.imageQualityIssues, 0),
  }
}

export function delta(current: number | null, previous: number | null) {
  return current == null || previous == null ? null : current - previous
}

export function coverageLabel(status: TenantResult['coverageStatus']) {
  return {
    AVAILABLE: 'Disponible',
    NO_DATA: 'Sin datos',
    NOT_SUPPORTED: 'Sin cobertura',
    UNAVAILABLE: 'No disponible',
  }[status]
}
