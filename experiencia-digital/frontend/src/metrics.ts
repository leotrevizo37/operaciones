import type { TenantResult } from './types'

export function interactionRate(tenants: TenantResult[], previous = false) {
  const period = tenants.map((tenant) => previous ? tenant.previous : tenant.current)
  const sessions = period.reduce((sum, value) => sum + value.users.sessionUserDays, 0)
  const complete = period.reduce((sum, value) => sum + value.users.completeInteractions, 0)
  return sessions ? (complete / sessions) * 100 : null
}

export function weightedUptime(tenants: TenantResult[], previous = false) {
  const period = tenants.map((tenant) => previous ? tenant.previous : tenant.current)
  const observed = period.reduce((sum, value) => sum + value.availability.observedServiceDays, 0)
  if (!observed) return null
  return period.reduce((sum, value) => sum + (value.availability.avgUptimePercentage ?? 0) * value.availability.observedServiceDays, 0) / observed
}

export function delta(current: number | null, previous: number | null) {
  if (current == null || previous == null) return null
  return current - previous
}

export function coverageLabel(status: TenantResult['coverageStatus']) {
  return { AVAILABLE: 'Disponible', NO_DATA: 'Sin datos', NOT_SUPPORTED: 'Sin cobertura', UNAVAILABLE: 'No disponible' }[status]
}
