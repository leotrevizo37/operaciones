package com.duma.devices.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import com.duma.devices.data.DevicesRepository;
import com.duma.devices.domain.CoverageStatus;
import com.duma.devices.domain.EquipmentKind;
import java.time.LocalDate;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.containers.MSSQLServerContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class DevicesRepositoryIT {

  private static final String DEVICE_A = "11111111-1111-1111-1111-111111111111";
  private static final String DEVICE_B = "22222222-2222-2222-2222-222222222222";
  private static final String LOCATION = "33333333-3333-3333-3333-333333333333";
  private static final String SUBLOCATION = "44444444-4444-4444-4444-444444444444";

  @Container
  private static final MSSQLServerContainer<?> SQL_SERVER =
      new MSSQLServerContainer<>("mcr.microsoft.com/mssql/server:2022-latest").acceptLicense();

  private TenantDataSourceRegistry registry;
  private DevicesRepository repository;
  private JdbcTemplate jdbc;

  @BeforeAll
  void connect() {
    ModuleProperties properties = properties();
    registry = new TenantDataSourceRegistry(properties);
    repository = new DevicesRepository(properties, registry);
    jdbc = registry.jdbc("tenant-test");
    jdbc.execute("IF SCHEMA_ID(N'dwh') IS NULL EXEC(N'CREATE SCHEMA dwh')");
  }

  @BeforeEach
  void resetTables() {
    jdbc.execute(
        "IF OBJECT_ID(N'dwh.factDeviceOperationalInsightHourly',N'U') IS NOT NULL DROP TABLE dwh.factDeviceOperationalInsightHourly");
    jdbc.execute(
        "IF OBJECT_ID(N'dwh.factDeviceOperationalInsightDaily',N'U') IS NOT NULL DROP TABLE dwh.factDeviceOperationalInsightDaily");
    jdbc.execute("CREATE TABLE dwh.factDeviceOperationalInsightHourly(Id int NOT NULL)");
    jdbc.execute(
        """
        CREATE TABLE dwh.factDeviceOperationalInsightDaily(
            DeviceId uniqueidentifier NOT NULL,
            LocationId uniqueidentifier NOT NULL,
            SubLocationId uniqueidentifier NOT NULL,
            DeviceName nvarchar(255) NULL,
            DeviceType nvarchar(255) NULL,
            LocalDate date NOT NULL,
            HealthScore decimal(9,4) NULL,
            OperationalState nvarchar(100) NOT NULL,
            WorstHourlyState nvarchar(100) NULL,
            CriticalHours int NOT NULL,
            DegradedHours int NOT NULL,
            WatchHours int NOT NULL,
            SevenDayHealthScore decimal(9,4) NULL,
            ThirtyDayHealthScore decimal(9,4) NULL,
            TrendDirection nvarchar(100) NULL,
            ConfidenceScore decimal(9,4) NULL,
            FailureRiskScore decimal(9,6) NULL,
            DominantReasonCode nvarchar(100) NULL,
            RecommendedAction nvarchar(1000) NULL,
            EvidenceJson nvarchar(max) NULL,
            FeatureSetVersion nvarchar(100) NULL,
            ScoringVersion nvarchar(100) NULL,
            ModelVersion nvarchar(100) NULL,
            ModifiedAt datetime2(0) NOT NULL
        )
        """);
  }

  @AfterAll
  void close() {
    registry.close();
  }

  @Test
  void prioritizesDailyDeviceRiskAndPreservesEquipmentTypeEvidence() {
    insertDevice(
        DEVICE_A,
        "Cuarto frio principal",
        "Refrigerador industrial",
        55.0,
        "CRITICAL",
        "CRITICAL",
        3,
        4,
        2,
        "DEGRADING",
        80.0,
        0.80);
    insertDevice(
        DEVICE_B, "Clima comedor", "HVAC", 95.0, "NORMAL", "NORMAL", 0, 0, 0, "STABLE", 90.0, 0.10);

    var result =
        repository.load("tenant-test", LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 31));

    assertThat(result.coverageStatus()).isEqualTo(CoverageStatus.AVAILABLE);
    assertThat(result.missingSources()).isEmpty();
    assertThat(result.current().devicesObserved()).isEqualTo(2);
    assertThat(result.current().avgHealthScore()).isCloseTo(75.0, within(0.001));
    assertThat(result.current().attentionDevices()).isEqualTo(1);
    assertThat(result.current().criticalDevices()).isEqualTo(1);
    assertThat(result.current().degradingDevices()).isEqualTo(1);
    assertThat(result.devices()).hasSize(2);
    assertThat(result.devices().get(0).deviceId()).isEqualTo(DEVICE_A);
    assertThat(result.devices().get(0).equipmentKind()).isEqualTo(EquipmentKind.CUARTO_FRIO);
    assertThat(result.devices().get(0).evidenceJson()).isEqualTo("{\"coverage\":0.55}");
  }

  private void insertDevice(
      String deviceId,
      String name,
      String type,
      double health,
      String state,
      String worstState,
      int criticalHours,
      int degradedHours,
      int watchHours,
      String trend,
      double confidence,
      double risk) {
    jdbc.update(
        """
        INSERT INTO dwh.factDeviceOperationalInsightDaily(
            DeviceId,LocationId,SubLocationId,DeviceName,DeviceType,LocalDate,HealthScore,
            OperationalState,WorstHourlyState,CriticalHours,DegradedHours,WatchHours,
            SevenDayHealthScore,ThirtyDayHealthScore,TrendDirection,ConfidenceScore,
            FailureRiskScore,DominantReasonCode,RecommendedAction,EvidenceJson,
            FeatureSetVersion,ScoringVersion,ModelVersion,ModifiedAt)
        VALUES(CONVERT(uniqueidentifier,?),CONVERT(uniqueidentifier,?),CONVERT(uniqueidentifier,?),
               ?,?,'2026-01-10',?,?,?, ?,?,?, ?,?,?,?, ?,N'COVERAGE',N'Revisar evidencia',
               N'{"coverage":0.55}',N'features-v1',N'scoring-v1',NULL,'2026-01-10T23:00:00')
        """,
        deviceId,
        LOCATION,
        SUBLOCATION,
        name,
        type,
        health,
        state,
        worstState,
        criticalHours,
        degradedHours,
        watchHours,
        health,
        health,
        trend,
        confidence,
        risk);
  }

  private ModuleProperties properties() {
    ModuleProperties properties = new ModuleProperties();
    properties.getWarehouse().setHost(SQL_SERVER.getHost());
    properties.getWarehouse().setPort(SQL_SERVER.getFirstMappedPort());
    properties.getWarehouse().setUsername(SQL_SERVER.getUsername());
    properties.getWarehouse().setPassword(SQL_SERVER.getPassword());
    properties.getWarehouse().setEncrypt(false);
    properties.getWarehouse().setTrustServerCertificate(true);
    ModuleProperties.Tenant tenant = new ModuleProperties.Tenant();
    tenant.setDisplayName("Tenant test");
    tenant.setDatabase("master");
    properties.getTenants().put("tenant-test", tenant);
    return properties;
  }
}
