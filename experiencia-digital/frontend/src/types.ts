export type HostContext = {
  protocolVersion: '1.0'
  moduleId: string
  locale: 'es-MX'
  timezone: string
  tenantIds: string[]
  period: { from: string; to: string }
  identity: { subject: string; displayName: string; roles: string[]; permissions: string[]; tenantScope: string[] }
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

export type CoverageStatus = 'AVAILABLE' | 'NO_DATA' | 'NOT_SUPPORTED' | 'UNAVAILABLE'

export type UserMetrics = {
  evaluatedUserDays: number
  sessionUserDays: number
  completeInteractions: number
  avgSessionSeconds: number | null
  avgLatencyMs: number | null
  maxP95LatencyMs: number | null
  slowUserDays: number
}

export type AvailabilityMetrics = {
  observedServiceDays: number
  avgUptimePercentage: number | null
  avgLatencySeconds: number | null
  maxP95LatencySeconds: number | null
  timeoutDays: number
  currentDownServices: number
  latestDate: string | null
}

export type PeriodMetrics = { users: UserMetrics; availability: AvailabilityMetrics }

export type TenantResult = {
  tenantId: string
  tenantName: string
  coverageStatus: CoverageStatus
  missingSources: string[]
  current: PeriodMetrics
  previous: PeriodMetrics
  errorCode: string | null
}

export type DashboardResponse = { generatedAt: string; from: string; to: string; tenants: TenantResult[] }
