import { describe, expect, it } from 'vitest'
import { coverageLabel, delta, weightedMetric } from './metrics'
import type { TenantResult } from './types'

const row = (observed: number, health: number | null): TenantResult => ({
  tenantId: 'x',
  tenantName: 'X',
  coverageStatus: 'AVAILABLE',
  missingSources: [],
  current: {
    devicesObserved: observed,
    avgHealthScore: health,
    attentionDevices: 0,
    criticalDevices: 0,
    degradingDevices: 0,
    avgFailureRiskScore: null,
    avgConfidenceScore: null,
    latestDate: null,
    latestModifiedAt: null,
  },
  previous: {
    devicesObserved: 0,
    avgHealthScore: null,
    attentionDevices: 0,
    criticalDevices: 0,
    degradingDevices: 0,
    avgFailureRiskScore: null,
    avgConfidenceScore: null,
    latestDate: null,
    latestModifiedAt: null,
  },
  devices: [],
  errorCode: null,
})

describe('devices metrics', () => {
  it('pondera salud por dispositivos observados', () => {
    expect(weightedMetric([row(10, 50), row(90, 100)], 'avgHealthScore')).toBe(95)
  })

  it('conserva ausencia como null', () => {
    expect(delta(null, 10)).toBeNull()
    expect(coverageLabel('NOT_SUPPORTED')).toBe('Sin cobertura')
  })
})
