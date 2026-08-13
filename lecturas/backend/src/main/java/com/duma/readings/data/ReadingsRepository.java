package com.duma.readings.data;

import com.duma.readings.config.ModuleProperties;
import com.duma.readings.config.TenantDataSourceRegistry;
import com.duma.readings.domain.CoverageStatus;
import com.duma.readings.domain.ReadingsDashboard;
import java.sql.Date;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
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
  private static final String MEASUREMENTS = "dwh.factReadingsMeasurement";
  private static final String DIMENSION = "dwh.dimSidonProdDimensions";
  private static final DateTimeFormatter LOCAL_TIME_FORMAT =
      DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss");
  private final ModuleProperties properties;
  private final TenantDataSourceRegistry registry;

  public ReadingsRepository(ModuleProperties properties, TenantDataSourceRegistry registry) {
    this.properties = properties;
    this.registry = registry;
  }

  public ReadingsDashboard.TenantResult load(String tenantId, LocalDate from, LocalDate to) {
    ModuleProperties.Tenant tenant = properties.getTenants().get(tenantId);
    if (!tenant.isEnabled() || tenant.getDatabase() == null || tenant.getDatabase().isBlank())
      return unavailable(tenantId, tenant.getDisplayName(), null);
    String stage = "data_source";
    try {
      JdbcTemplate jdbc = registry.jdbc(tenantId);
      stage = "fact_presence";
      boolean factPresent = objectExists(jdbc, FACT);
      boolean factReadable = factPresent && hasSelect(jdbc, FACT) == 1;
      boolean measurementsReadable =
          objectExists(jdbc, MEASUREMENTS) && hasSelect(jdbc, MEASUREMENTS) == 1;
      stage = "dimension_presence";
      boolean dimensionPresent =
          objectExists(jdbc, DIMENSION) && hasSelect(jdbc, DIMENSION) == 1;
      List<String> missing = new ArrayList<>();
      if (!factReadable) missing.add(FACT);
      if (!dimensionPresent) missing.add(DIMENSION);
      if (!factReadable && measurementsReadable) {
        stage = "measurement_fallback";
        return loadMeasurements(
            jdbc, tenantId, tenant.getDisplayName(), from, to, dimensionPresent, missing);
      }
      if (!factReadable)
        return new ReadingsDashboard.TenantResult(
            tenantId,
            tenant.getDisplayName(),
            factPresent ? CoverageStatus.UNAVAILABLE : CoverageStatus.NOT_SUPPORTED,
            List.copyOf(missing),
            ReadingsDashboard.Summary.empty(),
            ReadingsDashboard.Summary.empty(),
            List.of(),
            List.of(),
            List.of(),
            List.of(),
            factPresent ? "TENANT_QUERY_FAILED" : null);
      long days = ChronoUnit.DAYS.between(from, to) + 1;
      LocalDate previousTo = from.minusDays(1);
      LocalDate previousFrom = previousTo.minusDays(days - 1);
      stage = "current_summary";
      ReadingsDashboard.Summary current = summary(jdbc, from, to);
      stage = "previous_summary";
      ReadingsDashboard.Summary previous = summary(jdbc, previousFrom, previousTo);
      CoverageStatus status =
          current.sensorsObserved() == 0 ? CoverageStatus.NO_DATA : CoverageStatus.AVAILABLE;
      List<ReadingsDashboard.SensorException> exceptions =
          status == CoverageStatus.AVAILABLE
              ? exceptions(jdbc, from, to, dimensionPresent)
              : List.of();
      stage = "details";
      return new ReadingsDashboard.TenantResult(
          tenantId,
          tenant.getDisplayName(),
          status,
          List.copyOf(missing),
          current,
          previous,
          exceptions,
          status == CoverageStatus.AVAILABLE ? hourly(jdbc, from, to) : List.of(),
          status == CoverageStatus.AVAILABLE ? timeline(jdbc, from, to) : List.of(),
          status == CoverageStatus.AVAILABLE
              ? sensors(jdbc, from, to, dimensionPresent)
              : List.of(),
          null);
    } catch (DataAccessException exception) {
      Throwable cause = exception.getMostSpecificCause();
      if (cause instanceof SQLException sqlException) {
        log.warn(
            "tenant_query_failed module=lecturas tenant={} stage={} error={} sql_state={} sql_error={}",
            tenantId,
            stage,
            exception.getClass().getSimpleName(),
            sqlException.getSQLState(),
            sqlException.getErrorCode());
      } else {
        log.warn(
            "tenant_query_failed module=lecturas tenant={} stage={} error={}",
            tenantId,
            stage,
            exception.getClass().getSimpleName());
      }
      return unavailable(tenantId, tenant.getDisplayName(), "TENANT_QUERY_FAILED");
    } catch (IllegalArgumentException exception) {
      log.warn(
          "tenant_query_failed module=lecturas tenant={} stage={} error={}",
          tenantId,
          stage,
          exception.getClass().getSimpleName());
      return unavailable(tenantId, tenant.getDisplayName(), "TENANT_QUERY_FAILED");
    }
  }

  public Freshness freshness(String tenantId) {
    ModuleProperties.Tenant tenant = properties.getTenants().get(tenantId);
    if (!tenant.isEnabled() || tenant.getDatabase() == null || tenant.getDatabase().isBlank())
      return new Freshness(tenantId, tenant.getDisplayName(), "factRedingsAudits", null, null);
    try {
      List<Freshness> rows =
          registry
              .jdbc(tenantId)
              .query(
                  "SELECT LastRunStatus, LastLoadedAt FROM ctl.IngestionControl WHERE IngestionName = ?",
                  (resultSet, rowNumber) ->
                      new Freshness(
                          tenantId,
                          tenant.getDisplayName(),
                          "factRedingsAudits",
                          resultSet.getString("LastRunStatus"),
                          instant(resultSet.getTimestamp("LastLoadedAt"))),
                  "factRedingsAudits");
      return rows.isEmpty()
          ? new Freshness(tenantId, tenant.getDisplayName(), "factRedingsAudits", null, null)
          : rows.get(0);
    } catch (DataAccessException | IllegalArgumentException exception) {
      log.warn("freshness_query_failed module=lecturas tenant={}", tenantId);
      return new Freshness(tenantId, tenant.getDisplayName(), "factRedingsAudits", null, null);
    }
  }

  public record Freshness(
      String tenantId,
      String tenantName,
      String ingestionName,
      String lastRunStatus,
      java.time.Instant lastLoadedAt) {}

  private ReadingsDashboard.TenantResult loadMeasurements(
      JdbcTemplate jdbc,
      String tenantId,
      String tenantName,
      LocalDate from,
      LocalDate to,
      boolean dimensionPresent,
      List<String> missing) {
    long days = ChronoUnit.DAYS.between(from, to) + 1;
    LocalDate previousTo = from.minusDays(1);
    LocalDate previousFrom = previousTo.minusDays(days - 1);
    ReadingsDashboard.Summary current = measurementSummary(jdbc, from, to);
    ReadingsDashboard.Summary previous = measurementSummary(jdbc, previousFrom, previousTo);
    CoverageStatus status =
        current.sensorsObserved() == 0 ? CoverageStatus.NO_DATA : CoverageStatus.AVAILABLE;
    log.info(
        "tenant_source_selected module=lecturas tenant={} source={} coverage={}",
        tenantId,
        MEASUREMENTS,
        status);
    return new ReadingsDashboard.TenantResult(
        tenantId,
        tenantName,
        status,
        List.copyOf(missing),
        current,
        previous,
        status == CoverageStatus.AVAILABLE
            ? measurementExceptions(jdbc, from, to, dimensionPresent)
            : List.of(),
        status == CoverageStatus.AVAILABLE ? measurementHourly(jdbc, from, to) : List.of(),
        status == CoverageStatus.AVAILABLE ? measurementTimeline(jdbc, from, to) : List.of(),
        status == CoverageStatus.AVAILABLE
            ? measurementSensors(jdbc, from, to, dimensionPresent)
            : List.of(),
        null);
  }

  private ReadingsDashboard.Summary measurementSummary(
      JdbcTemplate jdbc, LocalDate from, LocalDate to) {
    return jdbc.queryForObject(
        """
            WITH ranked AS (
                SELECT SensorId, TimeSpan, LocalTimeSpan, COALESCE(ReadingsCount, 0) AS ReadingsCount,
                       ROW_NUMBER() OVER (PARTITION BY SensorId, TimeSpan ORDER BY ModifiedAt DESC, OperationId DESC) AS SourceRowNumber
                FROM dwh.factReadingsMeasurement
                WHERE TimeSpan >= ? AND TimeSpan < DATEADD(DAY, 1, ?)
            ), deduped AS (
                SELECT SensorId, TimeSpan, LocalTimeSpan, ReadingsCount
                FROM ranked WHERE SourceRowNumber = 1
            ), sequenced AS (
                SELECT SensorId, TimeSpan, LocalTimeSpan, ReadingsCount,
                       MAX(CASE WHEN ReadingsCount > 0 THEN TimeSpan END) OVER (PARTITION BY SensorId ORDER BY TimeSpan ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS LastReadingAt,
                       ROW_NUMBER() OVER (PARTITION BY SensorId ORDER BY TimeSpan DESC) AS LatestRow
                FROM deduped
            )
            SELECT COUNT_BIG(*) AS SensorsObserved,
                   COALESCE(SUM(CASE WHEN ReadingsCount > 0 THEN 1 ELSE 0 END), 0) AS HealthySensors,
                   COALESCE(SUM(CASE WHEN ReadingsCount <= 0 THEN 1 ELSE 0 END), 0) AS DisconnectedSensors,
                   CAST(0 AS bigint) AS LateSensors,
                   AVG(CASE WHEN ReadingsCount <= 0 AND LastReadingAt IS NOT NULL THEN CAST(DATEDIFF(MINUTE, LastReadingAt, TimeSpan) AS float) END) AS AvgMinutesWithoutReadings,
                   MAX(CASE WHEN ReadingsCount <= 0 AND LastReadingAt IS NOT NULL THEN CAST(DATEDIFF(MINUTE, LastReadingAt, TimeSpan) AS float) END) AS MaxMinutesWithoutReadings,
                   MAX(TimeSpan) AS LatestAuditAt,
                   MAX(LastReadingAt) AS LatestReadingAt
            FROM sequenced WHERE LatestRow = 1
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

  private List<ReadingsDashboard.SensorException> measurementExceptions(
      JdbcTemplate jdbc, LocalDate from, LocalDate to, boolean dimensionPresent) {
    String dimensionCte =
        dimensionPresent
            ? ", dimensions AS (SELECT SensorId, MAX(location_name) AS LocationName, MAX(device_name) AS DeviceName, MAX(sensor_name) AS SensorName FROM dwh.dimSidonProdDimensions GROUP BY SensorId)"
            : "";
    String names =
        dimensionPresent
            ? "COALESCE(d.LocationName, N'Sin ubicacion') AS LocationName, COALESCE(d.DeviceName, N'Sin dispositivo') AS DeviceName, COALESCE(d.SensorName, CONVERT(varchar(36), s.SensorId)) AS SensorName"
            : "N'Dimension no disponible' AS LocationName, N'Dimension no disponible' AS DeviceName, CONVERT(varchar(36), s.SensorId) AS SensorName";
    String join = dimensionPresent ? "LEFT JOIN dimensions AS d ON d.SensorId = s.SensorId" : "";
    String sql =
        """
            WITH ranked AS (
                SELECT SensorId, TimeSpan, COALESCE(ReadingsCount, 0) AS ReadingsCount,
                       ROW_NUMBER() OVER (PARTITION BY SensorId, TimeSpan ORDER BY ModifiedAt DESC, OperationId DESC) AS SourceRowNumber
                FROM dwh.factReadingsMeasurement
                WHERE TimeSpan >= ? AND TimeSpan < DATEADD(DAY, 1, ?)
            ), deduped AS (
                SELECT SensorId, TimeSpan, ReadingsCount FROM ranked WHERE SourceRowNumber = 1
            ), sequenced AS (
                SELECT SensorId, TimeSpan, ReadingsCount,
                       MAX(CASE WHEN ReadingsCount > 0 THEN TimeSpan END) OVER (PARTITION BY SensorId ORDER BY TimeSpan ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS LastReadingAt,
                       ROW_NUMBER() OVER (PARTITION BY SensorId ORDER BY TimeSpan DESC) AS LatestRow
                FROM deduped
            )%s
            SELECT TOP (50) CONVERT(varchar(36), s.SensorId) AS SensorId,
                   %s,
                   CAST(1 AS int) AS IsConnectionLost,
                   CAST(0 AS int) AS HasLateReadings,
                   CASE WHEN s.LastReadingAt IS NULL THEN NULL ELSE CAST(DATEDIFF(MINUTE, s.LastReadingAt, s.TimeSpan) AS float) END AS MinutesWithoutReadings,
                   s.TimeSpan, s.LastReadingAt
            FROM sequenced AS s %s
            WHERE s.LatestRow = 1 AND s.ReadingsCount <= 0
            ORDER BY MinutesWithoutReadings DESC, s.SensorId
            """
            .formatted(dimensionCte, names, join);
    return jdbc.query(
        sql,
        (resultSet, rowNumber) ->
            new ReadingsDashboard.SensorException(
                resultSet.getString("SensorId"),
                resultSet.getString("LocationName"),
                resultSet.getString("DeviceName"),
                resultSet.getString("SensorName"),
                resultSet.getInt("IsConnectionLost") == 1,
                false,
                nullableDouble(resultSet, "MinutesWithoutReadings"),
                instant(resultSet.getTimestamp("TimeSpan")),
                instant(resultSet.getTimestamp("LastReadingAt"))),
        Date.valueOf(from),
        Date.valueOf(to));
  }

  private List<ReadingsDashboard.SensorHourly> measurementHourly(
      JdbcTemplate jdbc, LocalDate from, LocalDate to) {
    return jdbc.query(
        """
            WITH ranked AS (
                SELECT SensorId, TimeSpan, COALESCE(ReadingsCount, 0) AS ReadingsCount,
                       ROW_NUMBER() OVER (PARTITION BY SensorId, TimeSpan ORDER BY ModifiedAt DESC, OperationId DESC) AS SourceRowNumber
                FROM dwh.factReadingsMeasurement
                WHERE TimeSpan >= ? AND TimeSpan < DATEADD(DAY, 1, ?)
            )
            SELECT TimeSpan, COUNT_BIG(*) AS Sensors,
                   AVG(CAST(ReadingsCount AS float)) AS AvgReadings,
                   COALESCE(SUM(ReadingsCount), 0) AS TotalReadings,
                   COALESCE(SUM(CASE WHEN ReadingsCount <= 0 THEN 1 ELSE 0 END), 0) AS LostSensors,
                   CAST(0 AS bigint) AS LateSensors
            FROM ranked WHERE SourceRowNumber = 1
            GROUP BY TimeSpan ORDER BY TimeSpan
            """,
        (resultSet, rowNumber) ->
            new ReadingsDashboard.SensorHourly(
                instant(resultSet.getTimestamp("TimeSpan")),
                resultSet.getLong("Sensors"),
                nullableDouble(resultSet, "AvgReadings"),
                resultSet.getLong("TotalReadings"),
                resultSet.getLong("LostSensors"),
                resultSet.getLong("LateSensors")),
        Date.valueOf(from),
        Date.valueOf(to));
  }

  private List<ReadingsDashboard.SensorTimeline> measurementTimeline(
      JdbcTemplate jdbc, LocalDate from, LocalDate to) {
    return jdbc.query(
        """
            WITH ranked AS (
                SELECT SensorId, TimeSpan, LocalTimeSpan, COALESCE(ReadingsCount, 0) AS ReadingsCount,
                       ROW_NUMBER() OVER (PARTITION BY SensorId, TimeSpan ORDER BY ModifiedAt DESC, OperationId DESC) AS SourceRowNumber
                FROM dwh.factReadingsMeasurement
                WHERE TimeSpan >= ? AND TimeSpan < DATEADD(DAY, 1, ?)
            ), deduped AS (
                SELECT SensorId, TimeSpan, LocalTimeSpan, ReadingsCount
                FROM ranked WHERE SourceRowNumber = 1
            )
            SELECT CONVERT(varchar(36), SensorId) AS SensorId, TimeSpan, LocalTimeSpan, ReadingsCount,
                   CAST(0 AS int) AS HasLateReadings,
                   CAST(CASE WHEN ReadingsCount <= 0 THEN 1 ELSE 0 END AS int) AS IsConnectionLost,
                   MAX(CASE WHEN ReadingsCount > 0 THEN TimeSpan END) OVER (PARTITION BY SensorId ORDER BY TimeSpan ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS LastReadingAt,
                   CASE WHEN ReadingsCount <= 0 THEN TimeSpan END AS ConnectionLostAt,
                   CASE WHEN ReadingsCount <= 0 THEN CAST(DATEDIFF(MINUTE, MAX(CASE WHEN ReadingsCount > 0 THEN TimeSpan END) OVER (PARTITION BY SensorId ORDER BY TimeSpan ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW), TimeSpan) AS float) END AS MinutesWithoutReadings
            FROM deduped ORDER BY SensorId, TimeSpan
            """,
        (resultSet, rowNumber) ->
            new ReadingsDashboard.SensorTimeline(
                resultSet.getString("SensorId"),
                instant(resultSet.getTimestamp("TimeSpan")),
                localTime(resultSet.getTimestamp("LocalTimeSpan")),
                resultSet.getLong("ReadingsCount"),
                false,
                resultSet.getInt("IsConnectionLost") == 1,
                instant(resultSet.getTimestamp("LastReadingAt")),
                instant(resultSet.getTimestamp("ConnectionLostAt")),
                nullableDouble(resultSet, "MinutesWithoutReadings")),
        Date.valueOf(from),
        Date.valueOf(to));
  }

  private List<ReadingsDashboard.SensorAggregate> measurementSensors(
      JdbcTemplate jdbc, LocalDate from, LocalDate to, boolean dimensionPresent) {
    String dimensionCte =
        dimensionPresent
            ? ", dimensions AS (SELECT SensorId, MAX(location_name) AS LocationName, MAX(device_name) AS DeviceName, MAX(sensor_name) AS SensorName FROM dwh.dimSidonProdDimensions GROUP BY SensorId)"
            : "";
    String names =
        dimensionPresent
            ? "COALESCE(d.LocationName, N'Sin ubicacion') AS LocationName, COALESCE(d.DeviceName, N'Sin dispositivo') AS DeviceName, COALESCE(d.SensorName, CONVERT(varchar(36), s.SensorId)) AS SensorName"
            : "N'Dimension no disponible' AS LocationName, N'Dimension no disponible' AS DeviceName, CONVERT(varchar(36), s.SensorId) AS SensorName";
    String join = dimensionPresent ? "LEFT JOIN dimensions AS d ON d.SensorId = s.SensorId" : "";
    String group =
        dimensionPresent
            ? "s.SensorId, d.LocationName, d.DeviceName, d.SensorName"
            : "s.SensorId";
    String sql =
        """
            WITH ranked AS (
                SELECT SensorId, TimeSpan, COALESCE(ReadingsCount, 0) AS ReadingsCount,
                       ROW_NUMBER() OVER (PARTITION BY SensorId, TimeSpan ORDER BY ModifiedAt DESC, OperationId DESC) AS SourceRowNumber
                FROM dwh.factReadingsMeasurement
                WHERE TimeSpan >= ? AND TimeSpan < DATEADD(DAY, 1, ?)
            ), deduped AS (
                SELECT SensorId, TimeSpan, ReadingsCount FROM ranked WHERE SourceRowNumber = 1
            ), sequenced AS (
                SELECT SensorId, TimeSpan, ReadingsCount,
                       MAX(CASE WHEN ReadingsCount > 0 THEN TimeSpan END) OVER (PARTITION BY SensorId ORDER BY TimeSpan ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS LastReadingAt
                FROM deduped
            )%s
            SELECT CONVERT(varchar(36), s.SensorId) AS SensorId,
                   %s,
                   COUNT_BIG(*) AS ObservedIntervals,
                   COALESCE(SUM(s.ReadingsCount), 0) AS TotalReadings,
                   AVG(CAST(s.ReadingsCount AS float)) AS AvgReadings,
                   COALESCE(SUM(CASE WHEN s.ReadingsCount <= 0 THEN 1 ELSE 0 END), 0) AS LostIntervals,
                   CAST(0 AS bigint) AS LateIntervals,
                   CAST(100.0 * SUM(CASE WHEN s.ReadingsCount > 0 THEN 1 ELSE 0 END) / NULLIF(COUNT_BIG(*), 0) AS float) AS HealthPercentage,
                   MAX(s.LastReadingAt) AS LastReadingAt,
                   MAX(CASE WHEN s.ReadingsCount <= 0 AND s.LastReadingAt IS NOT NULL THEN CAST(DATEDIFF(MINUTE, s.LastReadingAt, s.TimeSpan) AS float) END) AS MaxLossMinutes
            FROM sequenced AS s %s
            GROUP BY %s
            ORDER BY LostIntervals DESC, TotalReadings DESC
            """
            .formatted(dimensionCte, names, join, group);
    return jdbc.query(
        sql,
        (resultSet, rowNumber) ->
            new ReadingsDashboard.SensorAggregate(
                resultSet.getString("SensorId"),
                resultSet.getString("LocationName"),
                resultSet.getString("DeviceName"),
                resultSet.getString("SensorName"),
                resultSet.getLong("ObservedIntervals"),
                resultSet.getLong("TotalReadings"),
                nullableDouble(resultSet, "AvgReadings"),
                resultSet.getLong("LostIntervals"),
                resultSet.getLong("LateIntervals"),
                nullableDouble(resultSet, "HealthPercentage"),
                instant(resultSet.getTimestamp("LastReadingAt")),
                nullableDouble(resultSet, "MaxLossMinutes")),
        Date.valueOf(from),
        Date.valueOf(to));
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

  private List<ReadingsDashboard.SensorHourly> hourly(
      JdbcTemplate jdbc, LocalDate from, LocalDate to) {
    return jdbc.query(
        """
            SELECT TimeSpan,
                   COUNT_BIG(*) AS Sensors,
                   AVG(CAST(ReadingsCount AS float)) AS AvgReadings,
                   COALESCE(SUM(ReadingsCount), 0) AS TotalReadings,
                   COALESCE(SUM(CASE WHEN IsConnectionLost = 1 THEN 1 ELSE 0 END), 0) AS LostSensors,
                   COALESCE(SUM(CASE WHEN HasLateReadings = 1 THEN 1 ELSE 0 END), 0) AS LateSensors
            FROM observability.factRedingsAudits
            WHERE TimeSpan >= ? AND TimeSpan < DATEADD(DAY, 1, ?)
            GROUP BY TimeSpan
            ORDER BY TimeSpan
            """,
        (resultSet, rowNumber) ->
            new ReadingsDashboard.SensorHourly(
                instant(resultSet.getTimestamp("TimeSpan")),
                resultSet.getLong("Sensors"),
                nullableDouble(resultSet, "AvgReadings"),
                resultSet.getLong("TotalReadings"),
                resultSet.getLong("LostSensors"),
                resultSet.getLong("LateSensors")),
        Date.valueOf(from),
        Date.valueOf(to));
  }

  private List<ReadingsDashboard.SensorTimeline> timeline(
      JdbcTemplate jdbc, LocalDate from, LocalDate to) {
    return jdbc.query(
        """
            SELECT CONVERT(varchar(36), SensorId) AS SensorId,
                   TimeSpan, LocalTimeSpan, ReadingsCount,
                   CAST(HasLateReadings AS int) AS HasLateReadings,
                   CAST(IsConnectionLost AS int) AS IsConnectionLost,
                   LastReadingAt, ConnectionLostAt,
                   CAST(MinutesWithoutReadings AS float) AS MinutesWithoutReadings
            FROM observability.factRedingsAudits
            WHERE TimeSpan >= ? AND TimeSpan < DATEADD(DAY, 1, ?)
            ORDER BY SensorId, TimeSpan
            """,
        (resultSet, rowNumber) ->
            new ReadingsDashboard.SensorTimeline(
                resultSet.getString("SensorId"),
                instant(resultSet.getTimestamp("TimeSpan")),
                localTime(resultSet.getTimestamp("LocalTimeSpan")),
                resultSet.getLong("ReadingsCount"),
                resultSet.getInt("HasLateReadings") == 1,
                resultSet.getInt("IsConnectionLost") == 1,
                instant(resultSet.getTimestamp("LastReadingAt")),
                instant(resultSet.getTimestamp("ConnectionLostAt")),
                nullableDouble(resultSet, "MinutesWithoutReadings")),
        Date.valueOf(from),
        Date.valueOf(to));
  }

  private List<ReadingsDashboard.SensorAggregate> sensors(
      JdbcTemplate jdbc, LocalDate from, LocalDate to, boolean dimensionPresent) {
    String names =
        dimensionPresent
            ? "COALESCE(d.location_name, N'Sin ubicacion') AS LocationName, COALESCE(d.device_name, N'Sin dispositivo') AS DeviceName, COALESCE(d.sensor_name, CONVERT(varchar(36), a.SensorId)) AS SensorName"
            : "N'Dimension no disponible' AS LocationName, N'Dimension no disponible' AS DeviceName, CONVERT(varchar(36), a.SensorId) AS SensorName";
    String join =
        dimensionPresent
            ? "LEFT JOIN dwh.dimSidonProdDimensions AS d ON d.SensorId = a.SensorId"
            : "";
    String group =
        dimensionPresent
            ? "a.SensorId, d.location_name, d.device_name, d.sensor_name"
            : "a.SensorId";
    String sql =
        """
            SELECT CONVERT(varchar(36), a.SensorId) AS SensorId,
                   %s,
                   COUNT_BIG(*) AS ObservedIntervals,
                   COALESCE(SUM(a.ReadingsCount), 0) AS TotalReadings,
                   AVG(CAST(a.ReadingsCount AS float)) AS AvgReadings,
                   COALESCE(SUM(CASE WHEN a.IsConnectionLost = 1 THEN 1 ELSE 0 END), 0) AS LostIntervals,
                   COALESCE(SUM(CASE WHEN a.HasLateReadings = 1 THEN 1 ELSE 0 END), 0) AS LateIntervals,
                   CAST(100.0 * SUM(CASE WHEN a.IsConnectionLost = 0 THEN 1 ELSE 0 END) / NULLIF(COUNT_BIG(*), 0) AS float) AS HealthPercentage,
                   MAX(a.LastReadingAt) AS LastReadingAt,
                   MAX(CASE WHEN a.IsConnectionLost = 1 THEN CAST(a.MinutesWithoutReadings AS float) END) AS MaxLossMinutes
            FROM observability.factRedingsAudits AS a
            %s
            WHERE a.TimeSpan >= ? AND a.TimeSpan < DATEADD(DAY, 1, ?)
            GROUP BY %s
            ORDER BY LostIntervals DESC, LateIntervals DESC, TotalReadings DESC
            """
            .formatted(names, join, group);
    return jdbc.query(
        sql,
        (resultSet, rowNumber) ->
            new ReadingsDashboard.SensorAggregate(
                resultSet.getString("SensorId"),
                resultSet.getString("LocationName"),
                resultSet.getString("DeviceName"),
                resultSet.getString("SensorName"),
                resultSet.getLong("ObservedIntervals"),
                resultSet.getLong("TotalReadings"),
                nullableDouble(resultSet, "AvgReadings"),
                resultSet.getLong("LostIntervals"),
                resultSet.getLong("LateIntervals"),
                nullableDouble(resultSet, "HealthPercentage"),
                instant(resultSet.getTimestamp("LastReadingAt")),
                nullableDouble(resultSet, "MaxLossMinutes")),
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

  private int hasSelect(JdbcTemplate jdbc, String objectName) {
    Integer value =
        jdbc.queryForObject(
            "SELECT HAS_PERMS_BY_NAME(?, N'OBJECT', N'SELECT')", Integer.class, objectName);
    return value == null ? 0 : value;
  }

  private Double nullableDouble(java.sql.ResultSet resultSet, String column)
      throws java.sql.SQLException {
    double value = resultSet.getDouble(column);
    return resultSet.wasNull() ? null : value;
  }

  private java.time.Instant instant(Timestamp value) {
    return value == null ? null : value.toLocalDateTime().toInstant(ZoneOffset.UTC);
  }

  private String localTime(Timestamp value) {
    return value == null ? null : value.toLocalDateTime().format(LOCAL_TIME_FORMAT);
  }

  private ReadingsDashboard.TenantResult unavailable(String id, String name, String errorCode) {
    return new ReadingsDashboard.TenantResult(
        id,
        name,
        CoverageStatus.UNAVAILABLE,
        List.of(),
        ReadingsDashboard.Summary.empty(),
        ReadingsDashboard.Summary.empty(),
        List.of(),
        List.of(),
        List.of(),
        List.of(),
        errorCode);
  }
}
