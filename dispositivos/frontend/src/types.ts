export type HostContext = {
  protocolVersion: '1.0'
  moduleId: string
  locale: 'es-MX'
  timezone: string
  tenantIds: string[]
  period: { from: string; to: string }
  filters?: { location: string; device: string; sensor: string }
  freshness: Freshness[]
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
  eventMinutes?: number | null
  openEvents?: number
  sevenDayHealthScore: number | null
  thirtyDayHealthScore: number | null
  trendDirection: string | null
  confidenceScore: number | null
  peerPercentileRisk?: number | null
  failureRiskScore: number | null
  dominantReasonCode: string | null
  recommendedAction: string | null
  evidenceJson: string | null
  featureSetVersion: string | null
  scoringVersion: string | null
  modelVersion: string | null
  modifiedAt: string | null
}

export type DeviceHour = {
  deviceId: string; locationId: string; subLocationId: string; deviceName: string | null; deviceType: string | null; localTimeSpan: string; healthScore: number | null; operationalState: string | null; trendDirection: string | null; confidenceScore: number | null; coverageScore: number | null; expectedValueComplianceScore: number | null; sensorReliabilityScore: number | null; eventStabilityScore: number | null; behaviorStabilityScore: number | null; peerAlignmentScore: number | null; failureRiskScore: number | null; dominantReasonCode: string | null; recommendedAction: string | null; evidenceJson: string | null; featureSetVersion: string | null; scoringVersion: string | null; modelVersion: string | null; modifiedAt: string | null
}

export type DeviceDetailResponse = {
  generatedAt: string
  device: { tenantId: string; deviceId: string; locationId: string; subLocationId: string; localDate: string }
  operationalHours: Array<{ localTimeSpan: string; healthScore: number | null; operationalState: string | null; trendDirection: string | null; confidenceScore: number | null; coverageScore: number | null; expectedValueComplianceScore: number | null; sensorReliabilityScore: number | null; eventStabilityScore: number | null; behaviorStabilityScore: number | null; peerAlignmentScore: number | null; failureRiskScore: number | null; dominantReasonCode: string | null; recommendedAction: string | null; evidenceJson: string | null; featureSetVersion: string | null; scoringVersion: string | null; modelVersion: string | null }>
  measurements: Array<{ sensorId: string; sensorName: string | null; sensorType: string | null; localTimeSpan: string; measurementValue: number | null; measurementStdDev: number | null; anomalies: number | null; readingsCount: number | null; expectedMin: number | null; expectedMax: number | null; expectedSchedules: string | null; averageOutsideExpected: boolean | null; modifiedAt: string | null }>
  events: Array<{ sensorId: string; sensorName: string | null; sensorType: string | null; localTimeSpan: string; value: number | null; eventMinutes: number | null; completed: boolean }>
  audits: Array<{ sensorId: string; sensorName: string | null; sensorType: string | null; localTimeSpan: string; readingsCount: number; late: boolean; connectionLost: boolean; lastReadingAt: string | null; connectionLostAt: string | null; minutesWithoutReadings: number | null }>
  sensors: Array<{ sensorId: string; sensorName: string | null; sensorType: string | null; active: boolean; expectedMin: number | null; expectedMax: number | null; startTime: string | null; endTime: string | null; scheduledDays: string | null }>
}

export type TenantResult = {
  tenantId: string
  tenantName: string
  coverageStatus: 'AVAILABLE' | 'NO_DATA' | 'NOT_SUPPORTED' | 'UNAVAILABLE'
  missingSources: string[]
  current: Summary
  previous: Summary
  devices: Device[]
  daily?: Device[]
  hourly?: DeviceHour[]
  errorCode: string | null
}

export type DashboardResponse = {
  generatedAt: string
  from: string
  to: string
  tenants: TenantResult[]
}
