package com.duma.devices.data;

import com.duma.devices.config.ModuleProperties;
import com.duma.devices.config.TenantDataSourceRegistry;
import com.duma.devices.domain.CoverageStatus;
import com.duma.devices.domain.DevicesDashboard;
import com.duma.devices.domain.EquipmentTypeClassifier;
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
public class DevicesRepository {
  private static final Logger log = LoggerFactory.getLogger(DevicesRepository.class);
  private static final String DAILY = "dwh.factDeviceOperationalInsightDaily",
      HOURLY = "dwh.factDeviceOperationalInsightHourly";
  private final ModuleProperties properties;
  private final TenantDataSourceRegistry registry;

  public DevicesRepository(ModuleProperties properties, TenantDataSourceRegistry registry) {
    this.properties = properties;
    this.registry = registry;
  }

  public DevicesDashboard.TenantResult load(String id, LocalDate from, LocalDate to) {
    ModuleProperties.Tenant tenant = properties.getTenants().get(id);
    try {
      JdbcTemplate jdbc = registry.jdbc(id);
      boolean daily = exists(jdbc, DAILY), hourly = exists(jdbc, HOURLY);
      List<String> missing = new ArrayList<>();
      if (!daily) missing.add(DAILY);
      if (!hourly) missing.add(HOURLY);
      if (!daily)
        return new DevicesDashboard.TenantResult(
            id,
            tenant.getDisplayName(),
            CoverageStatus.NOT_SUPPORTED,
            List.copyOf(missing),
            DevicesDashboard.Summary.empty(),
            DevicesDashboard.Summary.empty(),
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
          null);
    } catch (DataAccessException | IllegalArgumentException exception) {
      log.warn("tenant_query_failed module=dispositivos tenant={}", id);
      return new DevicesDashboard.TenantResult(
          id,
          tenant.getDisplayName(),
          CoverageStatus.UNAVAILABLE,
          List.of(),
          DevicesDashboard.Summary.empty(),
          DevicesDashboard.Summary.empty(),
          List.of(),
          "TENANT_QUERY_FAILED");
    }
  }

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
               CAST(SevenDayHealthScore AS float) AS SevenDayHealthScore,CAST(ThirtyDayHealthScore AS float) AS ThirtyDayHealthScore,TrendDirection,
               CAST(ConfidenceScore AS float) AS ConfidenceScore,CAST(FailureRiskScore AS float) AS FailureRiskScore,DominantReasonCode,RecommendedAction,EvidenceJson,
               FeatureSetVersion,ScoringVersion,ModelVersion,ModifiedAt
        FROM latest WHERE rn=1 ORDER BY FailureRiskScore DESC, HealthScore, DeviceName, DeviceId
        """,
        (rs, row) ->
            new DevicesDashboard.Device(
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
                nullable(rs, "SevenDayHealthScore"),
                nullable(rs, "ThirtyDayHealthScore"),
                rs.getString("TrendDirection"),
                nullable(rs, "ConfidenceScore"),
                nullable(rs, "FailureRiskScore"),
                rs.getString("DominantReasonCode"),
                rs.getString("RecommendedAction"),
                rs.getString("EvidenceJson"),
                rs.getString("FeatureSetVersion"),
                rs.getString("ScoringVersion"),
                rs.getString("ModelVersion"),
                instant(rs.getTimestamp("ModifiedAt"))),
        Date.valueOf(from),
        Date.valueOf(to));
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

  private java.time.Instant instant(Timestamp v) {
    return v == null ? null : v.toLocalDateTime().toInstant(ZoneOffset.UTC);
  }
}
