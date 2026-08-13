CREATE OR ALTER PROCEDURE audit.usp_RecordSystemEvent
    @ApplicationId nvarchar(80),
    @EventType nvarchar(80),
    @EventName nvarchar(300),
    @Outcome nvarchar(30),
    @Severity nvarchar(20),
    @RequestId nvarchar(64) = NULL,
    @ActorId nvarchar(255) = NULL,
    @TenantId nvarchar(80) = NULL,
    @DurationMs bigint = NULL,
    @SourceIp nvarchar(64) = NULL,
    @UserAgent nvarchar(512) = NULL,
    @MetadataJson nvarchar(4000) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO audit.system_event (
        application_id,
        event_type,
        event_name,
        outcome,
        severity,
        request_id,
        actor_id,
        tenant_id,
        duration_ms,
        source_ip,
        user_agent,
        metadata_json
    )
    VALUES (
        @ApplicationId,
        @EventType,
        @EventName,
        @Outcome,
        @Severity,
        @RequestId,
        @ActorId,
        @TenantId,
        @DurationMs,
        @SourceIp,
        @UserAgent,
        @MetadataJson
    );
END;
GO

CREATE OR ALTER PROCEDURE security.usp_UpsertAppUser
    @Username nvarchar(255),
    @PasswordHash nvarchar(255),
    @DisplayName nvarchar(255),
    @Enabled bit,
    @RolesCsv nvarchar(1000),
    @PermissionsCsv nvarchar(2000),
    @TenantScopeCsv nvarchar(1000)
AS
BEGIN
    SET NOCOUNT ON;

    MERGE security.app_user AS target
    USING (SELECT LOWER(LTRIM(RTRIM(@Username))) AS username) AS source
        ON target.username = source.username
    WHEN MATCHED THEN
        UPDATE SET
            password_hash = @PasswordHash,
            display_name = @DisplayName,
            enabled = @Enabled,
            roles_csv = @RolesCsv,
            permissions_csv = @PermissionsCsv,
            tenant_scope_csv = @TenantScopeCsv,
            modified_at = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN
        INSERT (
            username,
            password_hash,
            display_name,
            enabled,
            roles_csv,
            permissions_csv,
            tenant_scope_csv
        )
        VALUES (
            source.username,
            @PasswordHash,
            @DisplayName,
            @Enabled,
            @RolesCsv,
            @PermissionsCsv,
            @TenantScopeCsv
        );
END;
GO
