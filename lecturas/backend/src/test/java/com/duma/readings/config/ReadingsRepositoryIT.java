package com.duma.readings.config;

import static org.assertj.core.api.Assertions.assertThat;

import com.duma.readings.data.ReadingsRepository;
import com.duma.readings.domain.CoverageStatus;
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
class ReadingsRepositoryIT {

  private static final String SENSOR_A = "11111111-1111-1111-1111-111111111111";
  private static final String SENSOR_B = "22222222-2222-2222-2222-222222222222";

  @Container
  private static final MSSQLServerContainer<?> SQL_SERVER =
      new MSSQLServerContainer<>("mcr.microsoft.com/mssql/server:2022-latest").acceptLicense();

  private TenantDataSourceRegistry registry;
  private ReadingsRepository repository;
  private JdbcTemplate jdbc;

  @BeforeAll
  void connect() {
    ModuleProperties properties = properties();
    registry = new TenantDataSourceRegistry(properties);
    repository = new ReadingsRepository(properties, registry);
    jdbc = registry.jdbc("tenant-test");
    jdbc.execute("IF SCHEMA_ID(N'observability') IS NULL EXEC(N'CREATE SCHEMA observability')");
    jdbc.execute("IF SCHEMA_ID(N'dwh') IS NULL EXEC(N'CREATE SCHEMA dwh')");
  }

  @BeforeEach
  void resetTables() {
    jdbc.execute(
        "IF OBJECT_ID(N'observability.factRedingsAudits',N'U') IS NOT NULL DROP TABLE observability.factRedingsAudits");
    jdbc.execute(
        "IF OBJECT_ID(N'dwh.dimSidonProdDimensions',N'U') IS NOT NULL DROP TABLE dwh.dimSidonProdDimensions");
    jdbc.execute(
        "IF OBJECT_ID(N'dwh.factReadingsMeasurement',N'U') IS NOT NULL DROP TABLE dwh.factReadingsMeasurement");
    jdbc.execute(
        """
        CREATE TABLE observability.factRedingsAudits(
            SensorId uniqueidentifier NOT NULL,
            TimeSpan datetime2(0) NOT NULL,
            LocalTimeSpan datetime2(0) NOT NULL,
            ReadingsCount bigint NOT NULL,
            HasLateReadings bit NOT NULL,
            IsConnectionLost bit NOT NULL,
            LastReadingAt datetime2(0) NULL,
            ConnectionLostAt datetime2(0) NULL,
            MinutesWithoutReadings int NULL
        )
        """);
    jdbc.execute(
        """
        CREATE TABLE dwh.factReadingsMeasurement(
            SensorId uniqueidentifier NOT NULL,
            TimeSpan datetime2(0) NOT NULL,
            LocalTimeSpan datetime2(0) NOT NULL,
            ReadingsCount bigint NULL,
            ModifiedAt datetime2(0) NOT NULL,
            OperationId uniqueidentifier NOT NULL
        )
        """);
    jdbc.execute(
        """
        CREATE TABLE dwh.dimSidonProdDimensions(
            SensorId uniqueidentifier NOT NULL PRIMARY KEY,
            location_name nvarchar(255) NULL,
            device_name nvarchar(255) NULL,
            sensor_name nvarchar(255) NULL
        )
        """);
  }

  @AfterAll
  void close() {
    registry.close();
  }

  @Test
  void returnsLatestSensorStateAndNamedExceptionFromSqlServer() {
    jdbc.update(
        """
        INSERT INTO dwh.dimSidonProdDimensions VALUES
            (CONVERT(uniqueidentifier,?),N'Sucursal Norte',N'Cuarto frio',N'Temperatura retorno'),
            (CONVERT(uniqueidentifier,?),N'Sucursal Sur',N'HVAC',N'Temperatura ambiente')
        """,
        SENSOR_A,
        SENSOR_B);
    jdbc.update(
        """
        INSERT INTO observability.factRedingsAudits VALUES
            (CONVERT(uniqueidentifier,?),'2026-01-10T12:00:00','2026-01-10T06:00:00',0,1,1,'2026-01-10T10:50:00','2026-01-10T11:00:00',70),
            (CONVERT(uniqueidentifier,?),'2026-01-10T12:00:00','2026-01-10T06:00:00',6,0,0,'2026-01-10T11:59:00',NULL,0)
        """,
        SENSOR_A,
        SENSOR_B);

    var result =
        repository.load("tenant-test", LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 31));

    assertThat(result.coverageStatus()).isEqualTo(CoverageStatus.AVAILABLE);
    assertThat(result.missingSources()).isEmpty();
    assertThat(result.current().sensorsObserved()).isEqualTo(2);
    assertThat(result.current().healthySensors()).isEqualTo(1);
    assertThat(result.current().disconnectedSensors()).isEqualTo(1);
    assertThat(result.current().lateSensors()).isEqualTo(1);
    assertThat(result.exceptions())
        .singleElement()
        .satisfies(
            exception -> {
              assertThat(exception.sensorId()).isEqualTo(SENSOR_A);
              assertThat(exception.locationName()).isEqualTo("Sucursal Norte");
              assertThat(exception.deviceName()).isEqualTo("Cuarto frio");
              assertThat(exception.sensorName()).isEqualTo("Temperatura retorno");
              assertThat(exception.disconnected()).isTrue();
              assertThat(exception.late()).isTrue();
            });
  }

  @Test
  void usesMeasurementsWhenAuditFactIsUnavailable() {
    jdbc.execute("DROP TABLE observability.factRedingsAudits");
    jdbc.update(
        """
        INSERT INTO dwh.dimSidonProdDimensions VALUES
            (CONVERT(uniqueidentifier,?),N'Sucursal Norte',N'Cuarto frio',N'Temperatura retorno'),
            (CONVERT(uniqueidentifier,?),N'Sucursal Sur',N'HVAC',N'Temperatura ambiente')
        """,
        SENSOR_A,
        SENSOR_B);
    jdbc.update(
        """
        INSERT INTO dwh.factReadingsMeasurement VALUES
            (CONVERT(uniqueidentifier,?),'2026-01-10T10:00:00','2026-01-10T04:00:00',6,'2026-01-10T10:05:00',NEWID()),
            (CONVERT(uniqueidentifier,?),'2026-01-10T11:00:00','2026-01-10T05:00:00',0,'2026-01-10T11:05:00',NEWID()),
            (CONVERT(uniqueidentifier,?),'2026-01-10T11:00:00','2026-01-10T05:00:00',5,'2026-01-10T11:05:00',NEWID())
        """,
        SENSOR_A,
        SENSOR_A,
        SENSOR_B);

    var result =
        repository.load("tenant-test", LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 31));

    assertThat(result.coverageStatus()).isEqualTo(CoverageStatus.AVAILABLE);
    assertThat(result.missingSources()).containsExactly("observability.factRedingsAudits");
    assertThat(result.current().sensorsObserved()).isEqualTo(2);
    assertThat(result.current().healthySensors()).isEqualTo(1);
    assertThat(result.current().disconnectedSensors()).isEqualTo(1);
    assertThat(result.current().lateSensors()).isZero();
    assertThat(result.exceptions()).singleElement().extracting("sensorId").isEqualTo(SENSOR_A);
    assertThat(result.hourly()).hasSize(2);
    assertThat(result.timeline()).hasSize(3);
    assertThat(result.sensors()).hasSize(2);
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
