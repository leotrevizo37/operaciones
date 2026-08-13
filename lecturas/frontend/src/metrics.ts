import type { TenantResult } from './types'
export function continuity(tenants: TenantResult[], previous = false) { const summaries = tenants.map((tenant) => previous ? tenant.previous : tenant.current); const observed = summaries.reduce((sum, item) => sum + item.sensorsObserved, 0); const healthy = summaries.reduce((sum, item) => sum + item.healthySensors, 0); return observed ? healthy / observed * 100 : null }
export function delta(current: number | null, previous: number | null) { return current == null || previous == null ? null : current - previous }
export function statusLabel(status: TenantResult['coverageStatus']) { return { AVAILABLE: 'Disponible', NO_DATA: 'Sin datos', NOT_SUPPORTED: 'Sin cobertura', UNAVAILABLE: 'No disponible' }[status] }
