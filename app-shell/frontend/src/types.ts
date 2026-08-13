export type Session = {
  subject: string
  displayName: string
  roles: string[]
  permissions: string[]
  tenantScope: string[]
}

export type ModuleRegistration = {
  moduleId: string
  displayName: string
  customElement: string
  remoteEntryUrl: string
  apiBaseUrl: string
  releaseStage: ReleaseStage
  dataEnvironment: DataEnvironment
  freshnessMode: FreshnessMode
  clearance: Clearance
  tenantScope: TenantScope
  capabilities: string[]
}

export type ReleaseStage = 'DEVELOPMENT' | 'TESTING' | 'STAGING' | 'PRODUCTION'
export type DataEnvironment = 'DEVELOPMENT' | 'TEST' | 'STAGE' | 'PRODUCTION'
export type FreshnessMode = 'LIVE' | 'SNAPSHOT' | 'MOCK'
export type Clearance = 'ACADEMIC_PRIVATE' | 'INTERNAL' | 'RESTRICTED'
export type TenantScope = 'ALL_TENANTS' | 'SELECTED_TENANTS' | 'CARLSJR_ONLY'

export type ModuleHostContext = {
  protocolVersion: '1.0'
  moduleId: string
  locale: 'es-MX'
  timezone: string
  tenantIds: string[]
  period: { from: string; to: string }
  identity: Session
  apiBaseUrl: string
  auth: { getAccessToken: (moduleId: string) => Promise<string> }
  navigate: (target: { moduleId: string; path?: string }) => void
}

export type DumaModuleElement = HTMLElement & {
  setHostContext: (context: ModuleHostContext) => void
}

export type Csrf = {
  headerName: string
  token: string
}
