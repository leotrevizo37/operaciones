export type HostContext = {
  protocolVersion: '1.0'
  moduleId: string
  locale: 'es-MX'
  timezone: string
  tenantIds: string[]
  period: { from: string; to: string }
  filters?: { location: string; device: string; sensor: string }
  freshness: Freshness[]
  identity: { subject: string; displayName: string; roles: string[]; permissions: string[]; tenantScope: string[] }
  apiBaseUrl: string
  auth: { getAccessToken: (moduleId: string) => Promise<string> }
  navigate: (target: { moduleId: string; path?: string }) => void
}

export type Freshness = { tenantId: string; tenantName: string; ingestionName: string; lastRunStatus: string | null; lastLoadedAt: string | null }

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

export type UserDaily = { metricDate: string; usersEvaluated: number; connectedUsers: number; completeInteractions: number; totalTimeConnected: number; avgLatencyMs: number | null; maxP95LatencyMs: number | null }
export type UserExperience = { userId: string; displayName: string; userName: string | null; position: string | null; daysEvaluated: number; completeInteractions: number; timeConnectedSeconds: number; avgSessionSeconds: number | null; maxSessionSeconds: number | null; avgLatencyMs: number | null; p95LatencyMs: number | null; lastActivityDate: string | null }
export type UserTimeline = { userId: string; metricDate: string; displayName: string; userName: string | null; madeCompleteInteraction: boolean; timeConnectedSeconds: number; avgLatencyMs: number | null; p95LatencyMs: number | null }
export type EndpointSummary = { url: string; uptimePercentage: number | null; avgLatencySeconds: number | null; latency95thPercentileSeconds: number | null; upDays: number; timeoutDays: number; observedDays: number; currentIsUp: boolean; currentTimeouts: boolean; latestDate: string }
export type AvailabilityDaily = { url: string; metricDate: string; uptimePercentage: number | null; avgLatencySeconds: number | null; latency95thPercentileSeconds: number | null; up: boolean; timeoutsPresent: boolean }

export type TenantResult = {
  tenantId: string
  tenantName: string
  coverageStatus: CoverageStatus
  missingSources: string[]
  current: PeriodMetrics
  previous: PeriodMetrics
  userDaily?: UserDaily[]
  users?: UserExperience[]
  userTimeline?: UserTimeline[]
  endpoints?: EndpointSummary[]
  availabilityDaily?: AvailabilityDaily[]
  errorCode: string | null
}

export type DashboardResponse = { generatedAt: string; from: string; to: string; tenants: TenantResult[] }
