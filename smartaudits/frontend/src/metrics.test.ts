import { describe, expect, it } from 'vitest'
import { aggregate, isPromotable } from './metrics'
import type { Summary, TenantResult } from './types'

const summary = (results: number, compliance: number, evidence: number, failed: number): Summary => ({
  resultCount: results,
  workPlanCount: 0,
  locationCount: 0,
  taskCount: 0,
  complianceResults: compliance,
  nonComplianceResults: results - compliance,
  complianceRate: results ? compliance / results * 100 : null,
  evidenceCount: evidence,
  failedEvidenceCount: failed,
  evidenceFailureRate: evidence ? failed / evidence * 100 : null,
  unclassifiedResults: 0,
  classificationCoverageRate: null,
  imageQualityIssues: 0,
  operationalIssues: 0,
  avgClassifierConfidence: null,
  avgReviewLatencyMinutes: null,
  latestSourceChangedAt: null,
  latestModifiedAt: null,
})

const tenant = (current: Summary): TenantResult => ({
  tenantId: 'x',
  tenantName: 'X',
  coverageStatus: 'AVAILABLE',
  missingSources: [],
  current,
  previous: summary(0, 0, 0, 0),
  categories: [],
  locations: [],
  recurrentIssues: [],
  errorCode: null,
})

describe('smartaudits metrics', () => {
  it('pondera tasas por sus denominadores reales', () => {
    const result = aggregate([tenant(summary(10, 5, 10, 5)), tenant(summary(90, 90, 90, 0))])
    expect(result.complianceRate).toBe(95)
    expect(result.evidenceFailureRate).toBe(5)
  })

  it('limita la promocion a las cinco categorias humanas', () => {
    expect(isPromotable('INCUMPLIMIENTO_GENERAL')).toBe(true)
    expect(isPromotable('SIN_CLASIFICAR')).toBe(false)
    expect(isPromotable('CUMPLIMIENTO')).toBe(false)
  })
})
