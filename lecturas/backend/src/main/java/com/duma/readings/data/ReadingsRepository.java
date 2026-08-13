package com.duma.readings.data;

import com.duma.readings.config.ModuleProperties;
import com.duma.readings.config.TenantDataSourceRegistry;
import com.duma.readings.domain.CoverageStatus;
import com.duma.readings.domain.ReadingsDashboard;
import java.sql.Date;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class ReadingsRepository {
  private static final Logger log = LoggerFactory.getLogger(ReadingsRepository.class);
  private static final String FACT = "observability.factRedingsAudits";
  private static final String DIMENSION = "dwh.dimSidonProdDimensions";
  private final ModuleProperties properties;
  private final TenantDataSourceRegistry registry;

  public ReadingsRepository(ModuleProperties properties, TenantDataSourceRegistry registry) {
    this.properties = properties;
    this.registry = registry;
  }

  public ReadingsDashboard.TenantResult load(String tenantId, LocalDate from, LocalDate to) {
    ModuleProperties.Tenant tenant = properties.getTenants().get(tenantId);
    try {
      JdbcTemplate jdbc = registry.jdbc(tenantId);
      boolean factPresent = objectExists(jdbc, FACT);
      boolean dimensionPresent = objectExists(jdbc, DIMENSION);
      List<String> missing = new ArrayList<>();
      if (!factPresent) missing.add(FACT);
      if (!dimensionPresent) missing.add(DIMENSION);
      if (!factPresent)
        return new ReadingsDashboard.TenantResult(
            tenantId,
            tenant.getDisplayName(),
            CoverageStatus.NOT_SUPPORTED,
            List.copyOf(missing),
            ReadingsDashboard.Summary.empty(),
            ReadingsDashboard.Summary.empty(),
            List.of(),
            null);
      long days = ChronoUnit.DAYS.between(from, to) + 1;
      LocalDate previousTo = from.minusDays(1);
      LocalDate previousFrom = previousTo.minusDays(days - 1);
      ReadingsDashboard.Summary current = summary(jdbc, from, to);
      ReadingsDashboard.Summary previous = summary(jdbc, previousFrom, previousTo);
      CoverageStatus status =
          current.sensorsObserved() == 0 ? CoverageStatus.NO_DATA : CoverageStatus.AVAILABLE;
      List<ReadingsDashboard.SensorException> exceptions =
          status == CoverageStatus.AVAILABLE
              ? exceptions(jdbc, from, to, dimensionPresent)
              : List.of();
      return new ReadingsDashboard.TenantResult(
          tenantId,
          tenant.getDisplayName(),
          status,
          List.copyOf(missing),
          current,
          previous,
          exceptions,
          null);
    } catch (DataAccessException | IllegalArgumentException exception) {
      log.warn("tenant_query_failed module=lecturas tenant={}", tenantId);
      return unavailable(tenantId, tenant.getDisplayName());
    }
  }

  private ReadingsDashboard.Summary summary(JdbcTemplate jdbc, LocalDate from, LocalDate to) {
    return jdbc.queryForObject(
        """
            WITH latest AS (
                SELECT SensorId, TimeSpan, HasLateReadings, IsConnectionLost, LastReadingAt, MinutesWithoutReadings,
                       ROW_NUMBER() OVER (PARTITION BY SensorId ORDER BY TimeSpan DESC) AS rn
                FROM observability.factRedingsAudits
                WHERE TimeSpan >= ? AND TimeSpan < DATEADD(DAY, 1, ?)
            )
            SELECT COUNT_BIG(*) AS SensorsObserved,
                   COALESCE(SUM(CASE WHEN IsConnectionLost = 0 THEN 1 ELSE 0 END), 0) AS HealthySensors,
                   COALESCE(SUM(CASE WHEN IsConnectionLost = 1 THEN 1 ELSE 0 END), 0) AS DisconnectedSensors,
                   COALESCE(SUM(CASE WHEN HasLateReadings = 1 THEN 1 ELSE 0 END), 0) AS LateSensors,
                   AVG(CAST(MinutesWithoutReadings AS float)) AS AvgMinutesWithoutReadings,
                   MAX(CAST(MinutesWithoutReadings AS float)) AS MaxMinutesWithoutReadings,
                   MAX(TimeSpan) AS LatestAuditAt,
                   MAX(LastReadingAt) AS LatestReadingAt
            FROM latest WHERE rn = 1
            """,
        (resultSet, rowNumber) ->
            new ReadingsDashboard.Summary(
                resultSet.getLong("SensorsObserved"),
                resultSet.getLong("HealthySensors"),
                resultSet.getLong("DisconnectedSensors"),
                resultSet.getLong("LateSensors"),
                nullableDouble(resultSet, "AvgMinutesWithoutReadings"),
                nullableDouble(resultSet, "MaxMinutesWithoutReadings"),
                instant(resultSet.getTimestamp("LatestAuditAt")),
                instant(resultSet.getTimestamp("LatestReadingAt"))),
        Date.valueOf(from),
        Date.valueOf(to));
  }

  private List<ReadingsDashboard.SensorException> exceptions(
      JdbcTemplate jdbc, LocalDate from, LocalDate to, boolean dimensionPresent) {
    String selectNames =
        dimensionPresent
            ? "COALESCE(d.location_name, N'Sin ubicacion') AS LocationName, COALESCE(d.device_name, N'Sin dispositivo') AS DeviceName, COALESCE(d.sensor_name, N'Sin nombre') AS SensorName"
            : "N'Dimension no disponible' AS LocationName, N'Dimension no disponible' AS DeviceName, N'Dimension no disponible' AS SensorName";
    String join =
        dimensionPresent
            ? "LEFT JOIN dwh.dimSidonProdDimensions AS d ON d.SensorId = latest.SensorId"
            : "";
    String sql =
        """
            WITH latest AS (
                SELECT SensorId, TimeSpan, HasLateReadings, IsConnectionLost, LastReadingAt, MinutesWithoutReadings,
                       ROW_NUMBER() OVER (PARTITION BY SensorId ORDER BY TimeSpan DESC) AS rn
                FROM observability.factRedingsAudits
                WHERE TimeSpan >= ? AND TimeSpan < DATEADD(DAY, 1, ?)
            )
            SELECT TOP (50) CONVERT(varchar(36), latest.SensorId) AS SensorId,
                   %s,
                   CAST(latest.IsConnectionLost AS int) AS IsConnectionLost,
                   CAST(latest.HasLateReadings AS int) AS HasLateReadings,
                   CAST(latest.MinutesWithoutReadings AS float) AS MinutesWithoutReadings,
                   latest.TimeSpan, latest.LastReadingAt
            FROM latest %s
            WHERE latest.rn = 1 AND (latest.IsConnectionLost = 1 OR latest.HasLateReadings = 1)
            ORDER BY latest.IsConnectionLost DESC, latest.MinutesWithoutReadings DESC, latest.SensorId
            """
            .formatted(selectNames, join);
    return jdbc.query(
        sql,
        (resultSet, rowNumber) ->
            new ReadingsDashboard.SensorException(
                resultSet.getString("SensorId"),
                resultSet.getString("LocationName"),
                resultSet.getString("DeviceName"),
                resultSet.getString("SensorName"),
                resultSet.getInt("IsConnectionLost") == 1,
                resultSet.getInt("HasLateReadings") == 1,
                nullableDouble(resultSet, "MinutesWithoutReadings"),
                instant(resultSet.getTimestamp("TimeSpan")),
                instant(resultSet.getTimestamp("LastReadingAt"))),
        Date.valueOf(from),
        Date.valueOf(to));
  }

  private boolean objectExists(JdbcTemplate jdbc, String objectName) {
    Integer value =
        jdbc.queryForObject(
            "SELECT CASE WHEN OBJECT_ID(?, N'U') IS NULL THEN 0 ELSE 1 END",
            Integer.class,
            objectName);
    return value != null && value == 1;
  }

  private Double nullableDouble(java.sql.ResultSet resultSet, String column)
      throws java.sql.SQLException {
    double value = resultSet.getDouble(column);
    return resultSet.wasNull() ? null : value;
  }

  private java.time.Instant instant(Timestamp value) {
    return value == null ? null : value.toLocalDateTime().toInstant(ZoneOffset.UTC);
  }

  private ReadingsDashboard.TenantResult unavailable(String id, String name) {
    return new ReadingsDashboard.TenantResult(
        id,
        name,
        CoverageStatus.UNAVAILABLE,
        List.of(),
        ReadingsDashboard.Summary.empty(),
        ReadingsDashboard.Summary.empty(),
        List.of(),
        "TENANT_QUERY_FAILED");
  }
}
