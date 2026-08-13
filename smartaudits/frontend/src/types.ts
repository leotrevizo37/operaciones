export type HostContext = {
  protocolVersion: '1.0'
  moduleId: string
  locale: 'es-MX'
  timezone: string
  tenantIds: string[]
  period: { from: string; to: string }
  identity: {
    subject: string
    displayName: string
    roles: string[]
    permissions: string[]
    tenantScope: string[]
  }
  apiBaseUrl: string
  auth: { getAccessToken: (moduleId: string) => Promise<string> }
  navigate: (target: { moduleId: string; path?: string }) => void
}

export type Manifest = {
  protocolVersion: '1.0'
  moduleId: string
  displayName: string
  releaseStage: string
  dataEnvironment: string
  freshnessMode: string
  clearance: string
  tenantScope: string
}

export type Summary = {
  resultCount: number
  workPlanCount: number
  locationCount: number
  taskCount: number
  complianceResults: number
  nonComplianceResults: number
  complianceRate: number | null
  evidenceCount: number
  failedEvidenceCount: number
  evidenceFailureRate: number | null
  unclassifiedResults: number
  classificationCoverageRate: number | null
  imageQualityIssues: number
  operationalIssues: number
  avgClassifierConfidence: number | null
  avgReviewLatencyMinutes: number | null
  latestSourceChangedAt: string | null
  latestModifiedAt: string | null
}

export type Category = {
  resultCategory: string
  resultCount: number
  resultShare: number | null
  locationCount: number
  taskCount: number
  avgClassifierConfidence: number | null
}

export type Location = {
  locationId: string | null
  locationName: string
  resultCount: number
  taskCount: number
  nonComplianceResults: number
  complianceRate: number | null
  evidenceFailureRate: number | null
  imageQualityIssues: number
  unclassifiedResults: number
  topIssueCategory: string | null
  topIssueCount: number
}

export type RecurrentIssue = {
  locationId: string | null
  locationName: string
  sublocationId: string | null
  sublocationName: string
  taskId: string | null
  taskName: string
  resultCategory: string
  recurrenceCount: number
  workPlanCount: number
  failedEvidenceCount: number
  firstDate: string | null
  lastDate: string | null
}

export type TenantResult = {
  tenantId: string
  tenantName: string
  coverageStatus: 'AVAILABLE' | 'NO_DATA' | 'NOT_SUPPORTED' | 'UNAVAILABLE'
  missingSources: string[]
  current: Summary
  previous: Summary
  categories: Category[]
  locations: Location[]
  recurrentIssues: RecurrentIssue[]
  errorCode: string | null
}

export type DashboardResponse = {
  generatedAt: string
  from: string
  to: string
  tenants: TenantResult[]
}

export type PromotableCategory =
  | 'IMAGEN_NO_PROCESABLE'
  | 'IMAGEN_NO_LEGIBLE'
  | 'FUERA_DE_RANGO'
  | 'INCUMPLIMIENTO_LIMPIEZA'
  | 'INCUMPLIMIENTO_GENERAL'

export type ReviewQueueItem = {
  normalizedCommentHash: string
  aiResult: 0
  sampleComment: string | null
  normalizedComment: string
  candidateCount: number
  firstSeenAt: string | null
  lastSeenAt: string | null
  lastPlanResultId: number | null
  lastEvidencePhotoId: number | null
  suggestedCategory: string | null
  suggestedMethod: string | null
  suggestedConfidence: number | null
  reviewStatus: 'PENDING'
}

export type ReviewQueuePage = {
  items: ReviewQueueItem[]
  totalCount: number
  page: number
  pageSize: number
}
