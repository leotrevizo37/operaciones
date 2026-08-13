IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'security')
BEGIN
    EXEC(N'CREATE SCHEMA security');
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'audit')
BEGIN
    EXEC(N'CREATE SCHEMA audit');
END;
GO

IF OBJECT_ID(N'security.app_user', N'U') IS NULL
BEGIN
    CREATE TABLE security.app_user (
        user_id uniqueidentifier NOT NULL CONSTRAINT PK_security_app_user PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
        username nvarchar(255) NOT NULL,
        password_hash nvarchar(255) NOT NULL,
        display_name nvarchar(255) NOT NULL,
        enabled bit NOT NULL CONSTRAINT DF_security_app_user_enabled DEFAULT (1),
        roles_csv nvarchar(1000) NOT NULL CONSTRAINT DF_security_app_user_roles DEFAULT (N''),
        permissions_csv nvarchar(2000) NOT NULL CONSTRAINT DF_security_app_user_permissions DEFAULT (N''),
        tenant_scope_csv nvarchar(1000) NOT NULL CONSTRAINT DF_security_app_user_tenants DEFAULT (N''),
        created_at datetime2(3) NOT NULL CONSTRAINT DF_security_app_user_created_at DEFAULT SYSUTCDATETIME(),
        modified_at datetime2(3) NOT NULL CONSTRAINT DF_security_app_user_modified_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_security_app_user_username UNIQUE (username)
    );
END;
GO

IF OBJECT_ID(N'audit.system_event', N'U') IS NULL
BEGIN
    CREATE TABLE audit.system_event (
        event_id bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_audit_system_event PRIMARY KEY,
        application_id nvarchar(80) NOT NULL,
        event_type nvarchar(80) NOT NULL,
        event_name nvarchar(300) NOT NULL,
        outcome nvarchar(30) NOT NULL,
        severity nvarchar(20) NOT NULL,
        request_id nvarchar(64) NULL,
        actor_id nvarchar(255) NULL,
        tenant_id nvarchar(80) NULL,
        duration_ms bigint NULL,
        source_ip nvarchar(64) NULL,
        user_agent nvarchar(512) NULL,
        metadata_json nvarchar(4000) NULL,
        created_at datetime2(3) NOT NULL CONSTRAINT DF_audit_system_event_created_at DEFAULT SYSUTCDATETIME()
    );
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_audit_system_event_application_created'
      AND object_id = OBJECT_ID(N'audit.system_event')
)
BEGIN
    CREATE INDEX IX_audit_system_event_application_created
        ON audit.system_event (application_id, created_at DESC)
        INCLUDE (event_type, event_name, outcome, tenant_id, request_id);
END;
GO
