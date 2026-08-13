package com.duma.devices.data;

import com.duma.devices.config.ModuleProperties;
import com.duma.devices.config.TenantDataSourceRegistry;
import com.duma.devices.domain.CoverageStatus;
import com.duma.devices.domain.DevicesDashboard;
import com.duma.devices.domain.EquipmentTypeClassifier;
import java.sql.Date;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class DevicesRepository {
  private static final Logger log = LoggerFactory.getLogger(DevicesRepository.class);
  private static final String DAILY = "dwh.factDeviceOperationalInsightDaily",
      HOURLY = "dwh.factDeviceOperationalInsightHourly";
  private static final DateTimeFormatter LOCAL_TIME_FORMAT =
      DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss");
  private final ModuleProperties properties;
  private final TenantDataSourceRegistry registry;

  public DevicesRepository(ModuleProperties properties, TenantDataSourceRegistry registry) {
    this.properties = properties;
    this.registry = registry;
  }

  public DevicesDashboard.TenantResult load(String id, LocalDate from, LocalDate to) {
    ModuleProperties.Tenant tenant = properties.getTenants().get(id);
    if (!tenant.isEnabled() || tenant.getDatabase() == null || tenant.getDatabase().isBlank()) {
      return new DevicesDashboard.TenantResult(
          id,
          tenant.getDisplayName(),
          CoverageStatus.UNAVAILABLE,
          List.of(),
          DevicesDashboard.Summary.empty(),
          DevicesDashboard.Summary.empty(),
          List.of(),
          List.of(),
          List.of(),
          null);
    }
    try {
      JdbcTemplate jdbc = registry.jdbc(id);
      boolean daily = exists(jdbc, DAILY), hourlyPresent = exists(jdbc, HOURLY);
      List<String> missing = new ArrayList<>();
      if (!daily) missing.add(DAILY);
      if (!hourlyPresent) missing.add(HOURLY);
      if (!daily)
        return new DevicesDashboard.TenantResult(
            id,
            tenant.getDisplayName(),
            CoverageStatus.NOT_SUPPORTED,
            List.copyOf(missing),
            DevicesDashboard.Summary.empty(),
            DevicesDashboard.Summary.empty(),
            List.of(),
            List.of(),
            List.of(),
            null);
      long days = ChronoUnit.DAYS.between(from, to) + 1;
      LocalDate previousTo = from.minusDays(1), previousFrom = previousTo.minusDays(days - 1);
      DevicesDashboard.Summary current = summary(jdbc, from, to),
          previous = summary(jdbc, previousFrom, previousTo);
      CoverageStatus status =
          current.devicesObserved() == 0 ? CoverageStatus.NO_DATA : CoverageStatus.AVAILABLE;
      List<DevicesDashboard.Device> devices =
          status == CoverageStatus.AVAILABLE ? devices(jdbc, from, to) : List.of();
      return new DevicesDashboard.TenantResult(
          id,
          tenant.getDisplayName(),
          status,
          List.copyOf(missing),
          current,
          previous,
          devices,
          status == CoverageStatus.AVAILABLE ? daily(jdbc, from, to) : List.of(),
          status == CoverageStatus.AVAILABLE && hourlyPresent ? hourly(jdbc, from, to) : List.of(),
          null);
    } catch (DataAccessException | IllegalArgumentException exception) {
      log.warn(
          "tenant_query_failed module=dispositivos tenant={} error={}",
          id,
          exception.getClass().getSimpleName());
      return new DevicesDashboard.TenantResult(
          id,
          tenant.getDisplayName(),
          CoverageStatus.UNAVAILABLE,
          List.of(),
          DevicesDashboard.Summary.empty(),
          DevicesDashboard.Summary.empty(),
          List.of(),
          List.of(),
          List.of(),
          "TENANT_QUERY_FAILED");
    }
  }

  public Freshness freshness(String tenantId) {
    ModuleProperties.Tenant tenant = properties.getTenants().get(tenantId);
    if (!tenant.isEnabled() || tenant.getDatabase() == null || tenant.getDatabase().isBlank())
      return new Freshness(
          tenantId, tenant.getDisplayName(), "DeviceOperationalInsight", null, null);
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
                          "DeviceOperationalInsight",
                          resultSet.getString("LastRunStatus"),
                          instant(resultSet.getTimestamp("LastLoadedAt"))),
                  "DeviceOperationalInsight");
      return rows.isEmpty()
          ? new Freshness(tenantId, tenant.getDisplayName(), "DeviceOperationalInsight", null, null)
          : rows.get(0);
    } catch (DataAccessException | IllegalArgumentException exception) {
      log.warn("freshness_query_failed module=dispositivos tenant={}", tenantId);
      return new Freshness(tenantId, tenant.getDisplayName(), "DeviceOperationalInsight", null, null);
    }
  }

  public record Freshness(
      String tenantId,
      String tenantName,
      String ingestionName,
      String lastRunStatus,
      java.time.Instant lastLoadedAt) {}

  private DevicesDashboard.Summary summary(JdbcTemplate jdbc, LocalDate from, LocalDate to) {
    return jdbc.queryForObject(
        """
        WITH latest AS (
            SELECT *, ROW_NUMBER() OVER (PARTITION BY DeviceId, LocationId, SubLocationId ORDER BY LocalDate DESC, ModifiedAt DESC) AS rn
            FROM dwh.factDeviceOperationalInsightDaily WHERE LocalDate BETWEEN ? AND ?
        )
        SELECT COUNT_BIG(*) AS DevicesObserved, AVG(CAST(HealthScore AS float)) AS AvgHealthScore,
               COALESCE(SUM(CASE WHEN OperationalState NOT IN (N'NORMAL',N'DATA_UNRELIABLE') THEN 1 ELSE 0 END),0) AS AttentionDevices,
               COALESCE(SUM(CASE WHEN OperationalState=N'CRITICAL' THEN 1 ELSE 0 END),0) AS CriticalDevices,
               COALESCE(SUM(CASE WHEN TrendDirection=N'DEGRADING' THEN 1 ELSE 0 END),0) AS DegradingDevices,
               AVG(CAST(FailureRiskScore AS float)) AS AvgFailureRiskScore, AVG(CAST(ConfidenceScore AS float)) AS AvgConfidenceScore,
               MAX(LocalDate) AS LatestDate, MAX(ModifiedAt) AS LatestModifiedAt
        FROM latest WHERE rn=1
        """,
        (rs, row) ->
            new DevicesDashboard.Summary(
                rs.getLong("DevicesObserved"),
                nullable(rs, "AvgHealthScore"),
                rs.getLong("AttentionDevices"),
                rs.getLong("CriticalDevices"),
                rs.getLong("DegradingDevices"),
                nullable(rs, "AvgFailureRiskScore"),
                nullable(rs, "AvgConfidenceScore"),
                rs.getDate("LatestDate") == null ? null : rs.getDate("LatestDate").toLocalDate(),
                instant(rs.getTimestamp("LatestModifiedAt"))),
        Date.valueOf(from),
        Date.valueOf(to));
  }

  private List<DevicesDashboard.Device> devices(JdbcTemplate jdbc, LocalDate from, LocalDate to) {
    return jdbc.query(
        """
        WITH latest AS (
            SELECT *, ROW_NUMBER() OVER (PARTITION BY DeviceId, LocationId, SubLocationId ORDER BY LocalDate DESC, ModifiedAt DESC) AS rn
            FROM dwh.factDeviceOperationalInsightDaily WHERE LocalDate BETWEEN ? AND ?
        )
        SELECT TOP (100) CONVERT(varchar(36),DeviceId) AS DeviceId,CONVERT(varchar(36),LocationId) AS LocationId,CONVERT(varchar(36),SubLocationId) AS SubLocationId,
               DeviceName,DeviceType,LocalDate,CAST(HealthScore AS float) AS HealthScore,OperationalState,WorstHourlyState,CriticalHours,DegradedHours,WatchHours,
               CAST(EventMinutes AS float) AS EventMinutes,OpenEvents,
               CAST(SevenDayHealthScore AS float) AS SevenDayHealthScore,CAST(ThirtyDayHealthScore AS float) AS ThirtyDayHealthScore,TrendDirection,
               CAST(ConfidenceScore AS float) AS ConfidenceScore,CAST(PeerPercentileRisk AS float) AS PeerPercentileRisk,CAST(FailureRiskScore AS float) AS FailureRiskScore,DominantReasonCode,RecommendedAction,EvidenceJson,
               FeatureSetVersion,ScoringVersion,ModelVersion,ModifiedAt
        FROM latest WHERE rn=1 ORDER BY FailureRiskScore DESC, HealthScore, DeviceName, DeviceId
        """,
        this::mapDevice,
        Date.valueOf(from),
        Date.valueOf(to));
  }

  private List<DevicesDashboard.Device> daily(JdbcTemplate jdbc, LocalDate from, LocalDate to) {
    return jdbc.query(
        """
        SELECT CONVERT(varchar(36),DeviceId) AS DeviceId,CONVERT(varchar(36),LocationId) AS LocationId,CONVERT(varchar(36),SubLocationId) AS SubLocationId,
               DeviceName,DeviceType,LocalDate,CAST(HealthScore AS float) AS HealthScore,OperationalState,WorstHourlyState,CriticalHours,DegradedHours,WatchHours,
               CAST(EventMinutes AS float) AS EventMinutes,OpenEvents,
               CAST(SevenDayHealthScore AS float) AS SevenDayHealthScore,CAST(ThirtyDayHealthScore AS float) AS ThirtyDayHealthScore,TrendDirection,
               CAST(ConfidenceScore AS float) AS ConfidenceScore,CAST(PeerPercentileRisk AS float) AS PeerPercentileRisk,CAST(FailureRiskScore AS float) AS FailureRiskScore,DominantReasonCode,RecommendedAction,EvidenceJson,
               FeatureSetVersion,ScoringVersion,ModelVersion,ModifiedAt
        FROM dwh.factDeviceOperationalInsightDaily
        WHERE LocalDate BETWEEN ? AND ?
        ORDER BY LocalDate,DeviceName,DeviceId
        """,
        this::mapDevice,
        Date.valueOf(from),
        Date.valueOf(to));
  }

  private List<DevicesDashboard.DeviceHour> hourly(
      JdbcTemplate jdbc, LocalDate from, LocalDate to) {
    return jdbc.query(
        """
        SELECT CONVERT(varchar(36),DeviceId) AS DeviceId,CONVERT(varchar(36),LocationId) AS LocationId,CONVERT(varchar(36),SubLocationId) AS SubLocationId,
               DeviceName,DeviceType,LocalTimeSpan,CAST(HealthScore AS float) AS HealthScore,OperationalState,TrendDirection,
               CAST(ConfidenceScore AS float) AS ConfidenceScore,CAST(CoverageScore AS float) AS CoverageScore,
               CAST(ExpectedValueComplianceScore AS float) AS ExpectedValueComplianceScore,CAST(SensorReliabilityScore AS float) AS SensorReliabilityScore,
               CAST(EventStabilityScore AS float) AS EventStabilityScore,CAST(BehaviorStabilityScore AS float) AS BehaviorStabilityScore,
               CAST(PeerAlignmentScore AS float) AS PeerAlignmentScore,CAST(FailureRiskScore AS float) AS FailureRiskScore,DominantReasonCode,
               RecommendedAction,EvidenceJson,FeatureSetVersion,ScoringVersion,ModelVersion,ModifiedAt
        FROM dwh.factDeviceOperationalInsightHourly
        WHERE LocalTimeSpan >= ? AND LocalTimeSpan < DATEADD(DAY,1,?)
        ORDER BY LocalTimeSpan,DeviceName,DeviceId
        """,
        this::mapDeviceHour,
        Date.valueOf(from),
        Date.valueOf(to));
  }

  public DevicesDashboard.DetailResponse detail(
      String tenantId,
      String deviceId,
      String locationId,
      String subLocationId,
      LocalDate localDate) {
    JdbcTemplate jdbc = registry.jdbc(tenantId);
    UUID device = UUID.fromString(deviceId);
    UUID location = UUID.fromString(locationId);
    UUID subLocation = UUID.fromString(subLocationId);
    Date date = Date.valueOf(localDate);
    List<DevicesDashboard.OperationalHour> operationalHours =
        jdbc.query(
            """
            SELECT LocalTimeSpan,CAST(HealthScore AS float) AS HealthScore,OperationalState,TrendDirection,
                   CAST(ConfidenceScore AS float) AS ConfidenceScore,CAST(CoverageScore AS float) AS CoverageScore,
                   CAST(ExpectedValueComplianceScore AS float) AS ExpectedValueComplianceScore,CAST(SensorReliabilityScore AS float) AS SensorReliabilityScore,
                   CAST(EventStabilityScore AS float) AS EventStabilityScore,CAST(BehaviorStabilityScore AS float) AS BehaviorStabilityScore,
                   CAST(PeerAlignmentScore AS float) AS PeerAlignmentScore,CAST(FailureRiskScore AS float) AS FailureRiskScore,DominantReasonCode,
                   RecommendedAction,EvidenceJson,FeatureSetVersion,ScoringVersion,ModelVersion
            FROM dwh.factDeviceOperationalInsightHourly
            WHERE DeviceId=? AND LocationId=? AND SubLocationId=? AND LocalTimeSpan>=? AND LocalTimeSpan<DATEADD(DAY,1,?)
            ORDER BY LocalTimeSpan
            """,
            (rs, row) ->
                new DevicesDashboard.OperationalHour(
                    localTime(rs.getTimestamp("LocalTimeSpan")),
                    nullable(rs, "HealthScore"),
                    rs.getString("OperationalState"),
                    rs.getString("TrendDirection"),
                    nullable(rs, "ConfidenceScore"),
                    nullable(rs, "CoverageScore"),
                    nullable(rs, "ExpectedValueComplianceScore"),
                    nullable(rs, "SensorReliabilityScore"),
                    nullable(rs, "EventStabilityScore"),
                    nullable(rs, "BehaviorStabilityScore"),
                    nullable(rs, "PeerAlignmentScore"),
                    nullable(rs, "FailureRiskScore"),
                    rs.getString("DominantReasonCode"),
                    rs.getString("RecommendedAction"),
                    rs.getString("EvidenceJson"),
                    rs.getString("FeatureSetVersion"),
                    rs.getString("ScoringVersion"),
                    rs.getString("ModelVersion")),
            device,
            location,
            subLocation,
            date,
            date);
    List<DevicesDashboard.Measurement> measurements =
        measurements(jdbc, device, location, subLocation, date);
    List<DevicesDashboard.SensorEvent> events = events(jdbc, device, location, subLocation, date);
    List<DevicesDashboard.ReadingAudit> audits =
        audits(jdbc, device, location, subLocation, date);
    List<DevicesDashboard.Sensor> sensors = sensors(jdbc, device, location, subLocation);
    return new DevicesDashboard.DetailResponse(
        Instant.now(),
        new DevicesDashboard.DeviceKey(
            tenantId, deviceId, locationId, subLocationId, localDate),
        operationalHours,
        measurements,
        events,
        audits,
        sensors);
  }

  private List<DevicesDashboard.Measurement> measurements(
      JdbcTemplate jdbc, UUID device, UUID location, UUID subLocation, Date date) {
    return jdbc.query(
        """
        WITH measurement_base AS (
          SELECT measurement.SensorId,measurement.DeviceId,measurement.LocationId,measurement.LocalTimeSpan,
                 measurement.MeasurementValue,measurement.MeasurementStdDev,measurement.Anomalies,measurement.ReadingsCount,measurement.ModifiedAt,
                 dimensions.sensor_name AS SensorName,dimensions.sensor_type AS SensorType,
                 ((DATEDIFF(DAY,CONVERT(date,'19000101',112),CONVERT(date,measurement.LocalTimeSpan)) % 7) + 1) AS IsoDay,
                 CONVERT(time(0),measurement.LocalTimeSpan) AS LocalTime,
                 ROW_NUMBER() OVER (PARTITION BY measurement.SensorId,measurement.DeviceId,measurement.LocationId,measurement.LocalTimeSpan
                                    ORDER BY measurement.ModifiedAt DESC,measurement.OperationId DESC) AS MeasurementRowNumber
          FROM dwh.factReadingsMeasurement AS measurement
          INNER JOIN dwh.dimSidonProdDimensions AS dimensions ON measurement.SensorId=dimensions.SensorId
          WHERE measurement.DeviceId=? AND measurement.LocationId=? AND dimensions.SubLocationId=?
            AND measurement.LocalTimeSpan>=? AND measurement.LocalTimeSpan<DATEADD(DAY,1,?)
        )
        SELECT CONVERT(varchar(36),measurement.SensorId) AS SensorId,measurement.SensorName,measurement.SensorType,measurement.LocalTimeSpan,
               CAST(measurement.MeasurementValue AS float) AS MeasurementValue,CAST(measurement.MeasurementStdDev AS float) AS MeasurementStdDev,
               measurement.Anomalies,measurement.ReadingsCount,CAST(expected.ExpectedMin AS float) AS ExpectedMin,
               CAST(expected.ExpectedMax AS float) AS ExpectedMax,expected.ExpectedSchedules,
               CASE WHEN expected.ExpectedMin IS NULL OR expected.ExpectedMax IS NULL OR measurement.MeasurementValue IS NULL THEN NULL
                    WHEN measurement.MeasurementValue<expected.ExpectedMin OR measurement.MeasurementValue>expected.ExpectedMax THEN 1 ELSE 0 END AS IsAverageOutsideExpected,
               measurement.ModifiedAt
        FROM measurement_base AS measurement
        OUTER APPLY (
          SELECT MIN(expected_value.min_expected_value) AS ExpectedMin,MAX(expected_value.max_expected_value) AS ExpectedMax,
                 STRING_AGG(CONCAT(CONVERT(varchar(5),expected_value.StartTime,108),'-',CONVERT(varchar(5),expected_value.EndTime,108),' ',expected_value.scheduledDays),', ') AS ExpectedSchedules
          FROM dwh.dimSensorExpectedVal AS expected_value
          WHERE expected_value.SensorId=measurement.SensorId AND expected_value.DeviceId=measurement.DeviceId
            AND measurement.LocalTime>=expected_value.StartTime AND measurement.LocalTime<=expected_value.EndTime
            AND (LTRIM(RTRIM(expected_value.scheduledDays)) IN ('','*') OR EXISTS (
              SELECT 1 FROM STRING_SPLIT(REPLACE(expected_value.scheduledDays,' ',''),',') AS scheduled_day
              WHERE TRY_CONVERT(int,scheduled_day.value)=measurement.IsoDay
                 OR (CHARINDEX('-',scheduled_day.value)>0 AND measurement.IsoDay BETWEEN
                     TRY_CONVERT(int,PARSENAME(REPLACE(scheduled_day.value,'-','.'),2)) AND
                     TRY_CONVERT(int,PARSENAME(REPLACE(scheduled_day.value,'-','.'),1)))
            ))
        ) AS expected
        WHERE measurement.MeasurementRowNumber=1
        ORDER BY measurement.SensorType,measurement.SensorName,measurement.SensorId,measurement.LocalTimeSpan
        """,
        (rs, row) ->
            new DevicesDashboard.Measurement(
                rs.getString("SensorId"),
                rs.getString("SensorName"),
                rs.getString("SensorType"),
                localTime(rs.getTimestamp("LocalTimeSpan")),
                nullable(rs, "MeasurementValue"),
                nullable(rs, "MeasurementStdDev"),
                nullableLong(rs, "Anomalies"),
                nullableLong(rs, "ReadingsCount"),
                nullable(rs, "ExpectedMin"),
                nullable(rs, "ExpectedMax"),
                rs.getString("ExpectedSchedules"),
                nullableBoolean(rs, "IsAverageOutsideExpected"),
                instant(rs.getTimestamp("ModifiedAt"))),
        device,
        location,
        subLocation,
        date,
        date);
  }

  private List<DevicesDashboard.SensorEvent> events(
      JdbcTemplate jdbc, UUID device, UUID location, UUID subLocation, Date date) {
    return jdbc.query(
        """
        SELECT CONVERT(varchar(36),events.SensorId) AS SensorId,events.SensorName,events.SensorType,events.LocalTimeSpan,
               CAST(events.Value AS float) AS Value,CAST(events.EventMinutes AS float) AS EventMinutes,CAST(events.IsEventCompleted AS int) AS IsEventCompleted
        FROM dwh.factSensorEvents AS events
        INNER JOIN dwh.dimSidonProdDimensions AS dimensions ON events.SensorId=dimensions.SensorId
        WHERE events.DeviceId=? AND events.LocationId=? AND dimensions.SubLocationId=?
          AND events.LocalTimeSpan>=? AND events.LocalTimeSpan<DATEADD(DAY,1,?)
        ORDER BY events.LocalTimeSpan,events.SensorType,events.SensorName
        """,
        (rs, row) ->
            new DevicesDashboard.SensorEvent(
                rs.getString("SensorId"),
                rs.getString("SensorName"),
                rs.getString("SensorType"),
                localTime(rs.getTimestamp("LocalTimeSpan")),
                nullable(rs, "Value"),
                nullable(rs, "EventMinutes"),
                rs.getInt("IsEventCompleted") == 1),
        device,
        location,
        subLocation,
        date,
        date);
  }

  private List<DevicesDashboard.ReadingAudit> audits(
      JdbcTemplate jdbc, UUID device, UUID location, UUID subLocation, Date date) {
    return jdbc.query(
        """
        SELECT CONVERT(varchar(36),audits.SensorId) AS SensorId,dimensions.sensor_name AS SensorName,dimensions.sensor_type AS SensorType,
               audits.LocalTimeSpan,audits.ReadingsCount,CAST(audits.HasLateReadings AS int) AS HasLateReadings,
               CAST(audits.IsConnectionLost AS int) AS IsConnectionLost,audits.LastReadingAt,audits.ConnectionLostAt,
               CAST(audits.MinutesWithoutReadings AS float) AS MinutesWithoutReadings
        FROM observability.factRedingsAudits AS audits
        INNER JOIN dwh.dimSidonProdDimensions AS dimensions ON audits.SensorId=dimensions.SensorId
        WHERE dimensions.DeviceId=? AND dimensions.LocationId=? AND dimensions.SubLocationId=?
          AND audits.LocalTimeSpan>=? AND audits.LocalTimeSpan<DATEADD(DAY,1,?)
        ORDER BY audits.LocalTimeSpan,dimensions.sensor_type,dimensions.sensor_name
        """,
        (rs, row) ->
            new DevicesDashboard.ReadingAudit(
                rs.getString("SensorId"),
                rs.getString("SensorName"),
                rs.getString("SensorType"),
                localTime(rs.getTimestamp("LocalTimeSpan")),
                rs.getLong("ReadingsCount"),
                rs.getInt("HasLateReadings") == 1,
                rs.getInt("IsConnectionLost") == 1,
                instant(rs.getTimestamp("LastReadingAt")),
                instant(rs.getTimestamp("ConnectionLostAt")),
                nullable(rs, "MinutesWithoutReadings")),
        device,
        location,
        subLocation,
        date,
        date);
  }

  private List<DevicesDashboard.Sensor> sensors(
      JdbcTemplate jdbc, UUID device, UUID location, UUID subLocation) {
    return jdbc.query(
        """
        SELECT CONVERT(varchar(36),dimensions.SensorId) AS SensorId,dimensions.sensor_name AS SensorName,dimensions.sensor_type AS SensorType,
               CAST(dimensions.Active AS int) AS Active,CAST(expected_value.min_expected_value AS float) AS ExpectedMin,
               CAST(expected_value.max_expected_value AS float) AS ExpectedMax,CONVERT(varchar(8),expected_value.StartTime,108) AS StartTime,
               CONVERT(varchar(8),expected_value.EndTime,108) AS EndTime,expected_value.scheduledDays AS ScheduledDays
        FROM dwh.dimSidonProdDimensions AS dimensions
        LEFT JOIN dwh.dimSensorExpectedVal AS expected_value ON dimensions.SensorId=expected_value.SensorId AND dimensions.DeviceId=expected_value.DeviceId
        WHERE dimensions.DeviceId=? AND dimensions.LocationId=? AND dimensions.SubLocationId=?
        ORDER BY dimensions.sensor_type,dimensions.sensor_name,dimensions.SensorId,expected_value.StartTime
        """,
        (rs, row) ->
            new DevicesDashboard.Sensor(
                rs.getString("SensorId"),
                rs.getString("SensorName"),
                rs.getString("SensorType"),
                rs.getInt("Active") == 1,
                nullable(rs, "ExpectedMin"),
                nullable(rs, "ExpectedMax"),
                rs.getString("StartTime"),
                rs.getString("EndTime"),
                rs.getString("ScheduledDays")),
        device,
        location,
        subLocation);
  }

  private DevicesDashboard.Device mapDevice(java.sql.ResultSet rs, int row)
      throws java.sql.SQLException {
    return new DevicesDashboard.Device(
        rs.getString("DeviceId"),
        rs.getString("LocationId"),
        rs.getString("SubLocationId"),
        rs.getString("DeviceName"),
        rs.getString("DeviceType"),
        EquipmentTypeClassifier.classify(rs.getString("DeviceType")),
        rs.getDate("LocalDate").toLocalDate(),
        nullable(rs, "HealthScore"),
        rs.getString("OperationalState"),
        rs.getString("WorstHourlyState"),
        rs.getLong("CriticalHours"),
        rs.getLong("DegradedHours"),
        rs.getLong("WatchHours"),
        nullable(rs, "EventMinutes"),
        rs.getLong("OpenEvents"),
        nullable(rs, "SevenDayHealthScore"),
        nullable(rs, "ThirtyDayHealthScore"),
        rs.getString("TrendDirection"),
        nullable(rs, "ConfidenceScore"),
        nullable(rs, "PeerPercentileRisk"),
        nullable(rs, "FailureRiskScore"),
        rs.getString("DominantReasonCode"),
        rs.getString("RecommendedAction"),
        rs.getString("EvidenceJson"),
        rs.getString("FeatureSetVersion"),
        rs.getString("ScoringVersion"),
        rs.getString("ModelVersion"),
        instant(rs.getTimestamp("ModifiedAt")));
  }

  private DevicesDashboard.DeviceHour mapDeviceHour(java.sql.ResultSet rs, int row)
      throws java.sql.SQLException {
    return new DevicesDashboard.DeviceHour(
        rs.getString("DeviceId"),
        rs.getString("LocationId"),
        rs.getString("SubLocationId"),
        rs.getString("DeviceName"),
        rs.getString("DeviceType"),
        localTime(rs.getTimestamp("LocalTimeSpan")),
        nullable(rs, "HealthScore"),
        rs.getString("OperationalState"),
        rs.getString("TrendDirection"),
        nullable(rs, "ConfidenceScore"),
        nullable(rs, "CoverageScore"),
        nullable(rs, "ExpectedValueComplianceScore"),
        nullable(rs, "SensorReliabilityScore"),
        nullable(rs, "EventStabilityScore"),
        nullable(rs, "BehaviorStabilityScore"),
        nullable(rs, "PeerAlignmentScore"),
        nullable(rs, "FailureRiskScore"),
        rs.getString("DominantReasonCode"),
        rs.getString("RecommendedAction"),
        rs.getString("EvidenceJson"),
        rs.getString("FeatureSetVersion"),
        rs.getString("ScoringVersion"),
        rs.getString("ModelVersion"),
        instant(rs.getTimestamp("ModifiedAt")));
  }

  private boolean exists(JdbcTemplate jdbc, String name) {
    Integer v =
        jdbc.queryForObject(
            "SELECT CASE WHEN OBJECT_ID(?,N'U') IS NULL THEN 0 ELSE 1 END", Integer.class, name);
    return v != null && v == 1;
  }

  private Double nullable(java.sql.ResultSet rs, String col) throws java.sql.SQLException {
    double v = rs.getDouble(col);
    return rs.wasNull() ? null : v;
  }

  private Long nullableLong(java.sql.ResultSet rs, String col) throws java.sql.SQLException {
    long v = rs.getLong(col);
    return rs.wasNull() ? null : v;
  }

  private Boolean nullableBoolean(java.sql.ResultSet rs, String col)
      throws java.sql.SQLException {
    int v = rs.getInt(col);
    return rs.wasNull() ? null : v == 1;
  }

  private java.time.Instant instant(Timestamp v) {
    return v == null ? null : v.toLocalDateTime().toInstant(ZoneOffset.UTC);
  }

  private String localTime(Timestamp value) {
    return value == null ? null : value.toLocalDateTime().format(LOCAL_TIME_FORMAT);
  }
}
