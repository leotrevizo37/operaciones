package com.duma.experience.data;

import com.duma.experience.config.ModuleProperties;
import com.duma.experience.config.TenantDataSourceRegistry;
import com.duma.experience.domain.CoverageResolver;
import com.duma.experience.domain.CoverageStatus;
import com.duma.experience.domain.ExperienceDashboard;
import java.sql.Date;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class ExperienceRepository {

  private static final Logger log = LoggerFactory.getLogger(ExperienceRepository.class);
  private static final String USER_SOURCE = "observability.factSidonUserUsage";
  private static final String AVAILABILITY_SOURCE = "observability.factUrlAvailabilityDaily";
  private final ModuleProperties properties;
  private final TenantDataSourceRegistry registry;

  public ExperienceRepository(ModuleProperties properties, TenantDataSourceRegistry registry) {
    this.properties = properties;
    this.registry = registry;
  }

  public ExperienceDashboard.TenantResult load(String tenantId, LocalDate from, LocalDate to) {
    ModuleProperties.Tenant tenant = properties.getTenants().get(tenantId);
    try {
      JdbcTemplate jdbc = registry.jdbc(tenantId);
      boolean usersPresent = objectExists(jdbc, USER_SOURCE);
      boolean availabilityPresent = objectExists(jdbc, AVAILABILITY_SOURCE);
      List<String> missingSources = new ArrayList<>();
      if (!usersPresent) missingSources.add(USER_SOURCE);
      if (!availabilityPresent) missingSources.add(AVAILABILITY_SOURCE);

      long days = ChronoUnit.DAYS.between(from, to) + 1;
      LocalDate previousTo = from.minusDays(1);
      LocalDate previousFrom = previousTo.minusDays(days - 1);
      ExperienceDashboard.PeriodMetrics current =
          loadPeriod(jdbc, from, to, usersPresent, availabilityPresent);
      ExperienceDashboard.PeriodMetrics previous =
          loadPeriod(jdbc, previousFrom, previousTo, usersPresent, availabilityPresent);
      CoverageStatus status =
          CoverageResolver.resolve(usersPresent, availabilityPresent, current.observedRows());
      return new ExperienceDashboard.TenantResult(
          tenantId,
          tenant.getDisplayName(),
          status,
          List.copyOf(missingSources),
          current,
          previous,
          null);
    } catch (DataAccessException exception) {
      log.warn("tenant_query_failed module=experiencia-digital tenant={}", tenantId);
      return unavailable(tenantId, tenant.getDisplayName());
    } catch (RuntimeException exception) {
      log.warn("tenant_configuration_failed module=experiencia-digital tenant={}", tenantId);
      return unavailable(tenantId, tenant.getDisplayName());
    }
  }

  private ExperienceDashboard.PeriodMetrics loadPeriod(
      JdbcTemplate jdbc,
      LocalDate from,
      LocalDate to,
      boolean usersPresent,
      boolean availabilityPresent) {
    ExperienceDashboard.UserMetrics users =
        usersPresent ? loadUsers(jdbc, from, to) : ExperienceDashboard.UserMetrics.empty();
    ExperienceDashboard.AvailabilityMetrics availability =
        availabilityPresent
            ? loadAvailability(jdbc, from, to)
            : ExperienceDashboard.AvailabilityMetrics.empty();
    return new ExperienceDashboard.PeriodMetrics(users, availability);
  }

  private ExperienceDashboard.UserMetrics loadUsers(
      JdbcTemplate jdbc, LocalDate from, LocalDate to) {
    return jdbc.queryForObject(
        """
            SELECT
                COUNT_BIG(*) AS EvaluatedUserDays,
                COALESCE(SUM(CASE WHEN HasConnected = 1 THEN 1 ELSE 0 END), 0) AS SessionUserDays,
                COALESCE(SUM(CASE WHEN MadeCompleteInteraction = 1 THEN 1 ELSE 0 END), 0) AS CompleteInteractions,
                AVG(CASE WHEN HasConnected = 1 AND TimeConnected > 0 THEN CAST(TimeConnected AS float) END) AS AvgSessionSeconds,
                AVG(CASE WHEN HasConnected = 1 AND AvgLatency > 0 THEN CAST(AvgLatency AS float) END) AS AvgLatencyMs,
                MAX(CAST(Latency95thPercentile AS float)) AS MaxP95LatencyMs,
                COALESCE(SUM(CASE WHEN HasConnected = 1 AND AvgLatency >= 2000 THEN 1 ELSE 0 END), 0) AS SlowUserDays
            FROM observability.factSidonUserUsage
            WHERE [Date] BETWEEN ? AND ?
            """,
        (resultSet, rowNumber) ->
            new ExperienceDashboard.UserMetrics(
                resultSet.getLong("EvaluatedUserDays"),
                resultSet.getLong("SessionUserDays"),
                resultSet.getLong("CompleteInteractions"),
                nullableDouble(resultSet, "AvgSessionSeconds"),
                nullableDouble(resultSet, "AvgLatencyMs"),
                nullableDouble(resultSet, "MaxP95LatencyMs"),
                resultSet.getLong("SlowUserDays")),
        Date.valueOf(from),
        Date.valueOf(to));
  }

  private ExperienceDashboard.AvailabilityMetrics loadAvailability(
      JdbcTemplate jdbc, LocalDate from, LocalDate to) {
    return jdbc.queryForObject(
        """
            WITH filtered AS (
                SELECT *
                FROM observability.factUrlAvailabilityDaily
                WHERE [Date] BETWEEN ? AND ?
            ), latest AS (
                SELECT *, ROW_NUMBER() OVER (PARTITION BY Url ORDER BY [Date] DESC, ModifiedAt DESC) AS rn
                FROM filtered
            )
            SELECT
                COUNT_BIG(*) AS ObservedServiceDays,
                AVG(CAST(UptimePercentage AS float)) AS AvgUptimePercentage,
                AVG(CAST(AvgLatencySeconds AS float)) AS AvgLatencySeconds,
                MAX(CAST(Latency95thPercentileSeconds AS float)) AS MaxP95LatencySeconds,
                COALESCE(SUM(CASE WHEN TimeoutsPresent = 1 THEN 1 ELSE 0 END), 0) AS TimeoutDays,
                (SELECT COUNT_BIG(*) FROM latest WHERE rn = 1 AND IsUp = 0) AS CurrentDownServices,
                MAX([Date]) AS LatestDate
            FROM filtered
            """,
        (resultSet, rowNumber) ->
            new ExperienceDashboard.AvailabilityMetrics(
                resultSet.getLong("ObservedServiceDays"),
                nullableDouble(resultSet, "AvgUptimePercentage"),
                nullableDouble(resultSet, "AvgLatencySeconds"),
                nullableDouble(resultSet, "MaxP95LatencySeconds"),
                resultSet.getLong("TimeoutDays"),
                resultSet.getLong("CurrentDownServices"),
                resultSet.getDate("LatestDate") == null
                    ? null
                    : resultSet.getDate("LatestDate").toLocalDate()),
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

  private ExperienceDashboard.TenantResult unavailable(String tenantId, String tenantName) {
    ExperienceDashboard.PeriodMetrics empty =
        new ExperienceDashboard.PeriodMetrics(
            ExperienceDashboard.UserMetrics.empty(),
            ExperienceDashboard.AvailabilityMetrics.empty());
    return new ExperienceDashboard.TenantResult(
        tenantId,
        tenantName,
        CoverageStatus.UNAVAILABLE,
        List.of(),
        empty,
        empty,
        "TENANT_QUERY_FAILED");
  }
}
