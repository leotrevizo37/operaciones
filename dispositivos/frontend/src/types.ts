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
  devicesObserved: number
  avgHealthScore: number | null
  attentionDevices: number
  criticalDevices: number
  degradingDevices: number
  avgFailureRiskScore: number | null
  avgConfidenceScore: number | null
  latestDate: string | null
  latestModifiedAt: string | null
}

export type EquipmentKind = 'CUARTO_FRIO' | 'HVAC' | 'BASCULA' | 'SEGURIDAD' | 'NO_CLASIFICADO'

export type Device = {
  deviceId: string
  locationId: string | null
  subLocationId: string | null
  deviceName: string | null
  deviceType: string | null
  equipmentKind: EquipmentKind
  localDate: string
  healthScore: number | null
  operationalState: string | null
  worstHourlyState: string | null
  criticalHours: number
  degradedHours: number
  watchHours: number
  sevenDayHealthScore: number | null
  thirtyDayHealthScore: number | null
  trendDirection: string | null
  confidenceScore: number | null
  failureRiskScore: number | null
  dominantReasonCode: string | null
  recommendedAction: string | null
  evidenceJson: string | null
  featureSetVersion: string | null
  scoringVersion: string | null
  modelVersion: string | null
  modifiedAt: string | null
}

export type TenantResult = {
  tenantId: string
  tenantName: string
  coverageStatus: 'AVAILABLE' | 'NO_DATA' | 'NOT_SUPPORTED' | 'UNAVAILABLE'
  missingSources: string[]
  current: Summary
  previous: Summary
  devices: Device[]
  errorCode: string | null
}

export type DashboardResponse = {
  generatedAt: string
  from: string
  to: string
  tenants: TenantResult[]
}
