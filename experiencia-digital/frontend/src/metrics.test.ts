import { describe, expect, it } from 'vitest'
import { coverageLabel, delta, interactionRate, weightedUptime } from './metrics'
import type { TenantResult } from './types'

const tenant = (sessions: number, complete: number, observed: number, uptime: number): TenantResult => ({
  tenantId: 'test', tenantName: 'Test', coverageStatus: 'AVAILABLE', missingSources: [], errorCode: null,
  current: { users: { evaluatedUserDays: sessions, sessionUserDays: sessions, completeInteractions: complete, avgSessionSeconds: null, avgLatencyMs: null, maxP95LatencyMs: null, slowUserDays: 0 }, availability: { observedServiceDays: observed, avgUptimePercentage: uptime, avgLatencySeconds: null, maxP95LatencySeconds: null, timeoutDays: 0, currentDownServices: 0, latestDate: null } },
  previous: { users: { evaluatedUserDays: 0, sessionUserDays: 0, completeInteractions: 0, avgSessionSeconds: null, avgLatencyMs: null, maxP95LatencyMs: null, slowUserDays: 0 }, availability: { observedServiceDays: 0, avgUptimePercentage: null, avgLatencySeconds: null, maxP95LatencySeconds: null, timeoutDays: 0, currentDownServices: 0, latestDate: null } },
})

describe('experience metrics', () => {
  it('pondera tasas por sus denominadores', () => {
    expect(interactionRate([tenant(10, 5, 10, 90), tenant(90, 90, 90, 100)])).toBe(95)
    expect(weightedUptime([tenant(10, 5, 10, 90), tenant(90, 90, 90, 100)])).toBe(99)
  })

  it('no convierte ausencia de baseline en cero', () => {
    expect(delta(null, 10)).toBeNull()
    expect(coverageLabel('NOT_SUPPORTED')).toBe('Sin cobertura')
  })
})
