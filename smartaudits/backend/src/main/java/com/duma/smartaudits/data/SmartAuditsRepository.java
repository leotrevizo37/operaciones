package com.duma.smartaudits.data;

import com.duma.smartaudits.config.ModuleProperties;
import com.duma.smartaudits.config.TenantDataSourceRegistry;
import com.duma.smartaudits.domain.CoverageStatus;
import com.duma.smartaudits.domain.SmartAuditsDashboard;
import java.sql.Date;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class SmartAuditsRepository {
  private static final Logger log = LoggerFactory.getLogger(SmartAuditsRepository.class);
  private static final String FACT = "dwh.factSmartauditsCategories";
  private final ModuleProperties properties;
  private final TenantDataSourceRegistry registry;

  public SmartAuditsRepository(ModuleProperties properties, TenantDataSourceRegistry registry) {
    this.properties = properties;
    this.registry = registry;
  }

  public SmartAuditsDashboard.TenantResult load(String tenantId, LocalDate from, LocalDate to) {
    ModuleProperties.Tenant tenant = properties.getTenants().get(tenantId);
    try {
      JdbcTemplate jdbc = registry.jdbc(tenantId);
      if (!exists(jdbc, FACT)) {
        return unavailable(
            tenantId, tenant.getDisplayName(), CoverageStatus.NOT_SUPPORTED, List.of(FACT), null);
      }
      long days = ChronoUnit.DAYS.between(from, to) + 1;
      LocalDate previousTo = from.minusDays(1);
      LocalDate previousFrom = previousTo.minusDays(days - 1);
      SmartAuditsDashboard.Summary current = summary(jdbc, from, to);
      SmartAuditsDashboard.Summary previous = summary(jdbc, previousFrom, previousTo);
      if (current.resultCount() == 0) {
        return new SmartAuditsDashboard.TenantResult(
            tenantId,
            tenant.getDisplayName(),
            CoverageStatus.NO_DATA,
            List.of(),
            current,
            previous,
            List.of(),
            List.of(),
            List.of(),
            null);
      }
      return new SmartAuditsDashboard.TenantResult(
          tenantId,
          tenant.getDisplayName(),
          CoverageStatus.AVAILABLE,
          List.of(),
          current,
          previous,
          categories(jdbc, from, to),
          locations(jdbc, from, to),
          recurrentIssues(jdbc, from, to),
          null);
    } catch (DataAccessException | IllegalArgumentException exception) {
      log.warn("tenant_query_failed module=smartaudits tenant={}", tenantId);
      return unavailable(
          tenantId,
          tenant.getDisplayName(),
          CoverageStatus.UNAVAILABLE,
          List.of(),
          "TENANT_QUERY_FAILED");
    }
  }

  private SmartAuditsDashboard.TenantResult unavailable(
      String tenantId,
      String tenantName,
      CoverageStatus status,
      List<String> missingSources,
      String errorCode) {
    return new SmartAuditsDashboard.TenantResult(
        tenantId,
        tenantName,
        status,
        missingSources,
        SmartAuditsDashboard.Summary.empty(),
        SmartAuditsDashboard.Summary.empty(),
        List.of(),
        List.of(),
        List.of(),
        errorCode);
  }

  private SmartAuditsDashboard.Summary summary(JdbcTemplate jdbc, LocalDate from, LocalDate to) {
    return jdbc.queryForObject(
        """
                WITH period AS (
                    SELECT *,
                           CASE WHEN ReviewDate IS NOT NULL AND ReviewAIDate IS NOT NULL AND ReviewAIDate >= ReviewDate
                                THEN DATEDIFF(SECOND, ReviewDate, ReviewAIDate) / 60.0 END AS ReviewLatencyMinutes
                    FROM dwh.factSmartauditsCategories
                    WHERE CONVERT(date, COALESCE(ReviewAIDate, ReviewDate, SourceLastChangedAt)) BETWEEN ? AND ?
                )
                SELECT COUNT_BIG(*) AS ResultCount,
                       COUNT_BIG(DISTINCT WorkPlanId) AS WorkPlanCount,
                       COUNT_BIG(DISTINCT LocationId) AS LocationCount,
                       COUNT_BIG(DISTINCT [Task]) AS TaskCount,
                       COALESCE(SUM(CASE WHEN ResultCategory=N'CUMPLIMIENTO' THEN 1 ELSE 0 END),0) AS ComplianceResults,
                       COALESCE(SUM(CASE WHEN ResultCategory<>N'CUMPLIMIENTO' THEN 1 ELSE 0 END),0) AS NonComplianceResults,
                       CAST(100.0*SUM(CASE WHEN ResultCategory=N'CUMPLIMIENTO' THEN 1 ELSE 0 END)/NULLIF(COUNT_BIG(*),0) AS float) AS ComplianceRate,
                       COALESCE(SUM(EvidenceCount),0) AS EvidenceCount,
                       COALESCE(SUM(FailedEvidenceCount),0) AS FailedEvidenceCount,
                       CAST(100.0*SUM(FailedEvidenceCount)/NULLIF(SUM(EvidenceCount),0) AS float) AS EvidenceFailureRate,
                       COALESCE(SUM(CASE WHEN ResultCategory=N'SIN_CLASIFICAR' THEN 1 ELSE 0 END),0) AS UnclassifiedResults,
                       CAST(100.0*SUM(CASE WHEN ResultCategory<>N'SIN_CLASIFICAR' THEN 1 ELSE 0 END)/NULLIF(COUNT_BIG(*),0) AS float) AS ClassificationCoverageRate,
                       COALESCE(SUM(CASE WHEN ResultCategory IN (N'IMAGEN_NO_LEGIBLE',N'IMAGEN_NO_PROCESABLE') THEN 1 ELSE 0 END),0) AS ImageQualityIssues,
                       COALESCE(SUM(CASE WHEN ResultCategory IN (N'FUERA_DE_RANGO',N'INCUMPLIMIENTO_LIMPIEZA',N'INCUMPLIMIENTO_GENERAL') THEN 1 ELSE 0 END),0) AS OperationalIssues,
                       AVG(CASE WHEN ResultCategory<>N'SIN_CLASIFICAR' THEN CAST(ClassifierConfidence AS float) END) AS AvgClassifierConfidence,
                       AVG(CAST(ReviewLatencyMinutes AS float)) AS AvgReviewLatencyMinutes,
                       MAX(SourceLastChangedAt) AS LatestSourceChangedAt,
                       MAX(ModifiedAt) AS LatestModifiedAt
                FROM period
                """,
        (rs, row) ->
            new SmartAuditsDashboard.Summary(
                rs.getLong("ResultCount"),
                rs.getLong("WorkPlanCount"),
                rs.getLong("LocationCount"),
                rs.getLong("TaskCount"),
                rs.getLong("ComplianceResults"),
                rs.getLong("NonComplianceResults"),
                nullableDouble(rs, "ComplianceRate"),
                rs.getLong("EvidenceCount"),
                rs.getLong("FailedEvidenceCount"),
                nullableDouble(rs, "EvidenceFailureRate"),
                rs.getLong("UnclassifiedResults"),
                nullableDouble(rs, "ClassificationCoverageRate"),
                rs.getLong("ImageQualityIssues"),
                rs.getLong("OperationalIssues"),
                nullableDouble(rs, "AvgClassifierConfidence"),
                nullableDouble(rs, "AvgReviewLatencyMinutes"),
                instant(rs.getTimestamp("LatestSourceChangedAt")),
                instant(rs.getTimestamp("LatestModifiedAt"))),
        Date.valueOf(from),
        Date.valueOf(to));
  }

  private List<SmartAuditsDashboard.Category> categories(
      JdbcTemplate jdbc, LocalDate from, LocalDate to) {
    return jdbc.query(
        """
                WITH period AS (
                    SELECT * FROM dwh.factSmartauditsCategories
                    WHERE CONVERT(date, COALESCE(ReviewAIDate, ReviewDate, SourceLastChangedAt)) BETWEEN ? AND ?
                )
                SELECT ResultCategory,
                       COUNT_BIG(*) AS ResultCount,
                       CAST(100.0*COUNT_BIG(*)/NULLIF((SELECT COUNT_BIG(*) FROM period),0) AS float) AS ResultShare,
                       COUNT_BIG(DISTINCT LocationId) AS LocationCount,
                       COUNT_BIG(DISTINCT [Task]) AS TaskCount,
                       AVG(CAST(ClassifierConfidence AS float)) AS AvgClassifierConfidence
                FROM period
                GROUP BY ResultCategory
                ORDER BY ResultCount DESC, ResultCategory
                """,
        (rs, row) ->
            new SmartAuditsDashboard.Category(
                rs.getString("ResultCategory"),
                rs.getLong("ResultCount"),
                nullableDouble(rs, "ResultShare"),
                rs.getLong("LocationCount"),
                rs.getLong("TaskCount"),
                nullableDouble(rs, "AvgClassifierConfidence")),
        Date.valueOf(from),
        Date.valueOf(to));
  }

  private List<SmartAuditsDashboard.Location> locations(
      JdbcTemplate jdbc, LocalDate from, LocalDate to) {
    return jdbc.query(
        """
                WITH period AS (
                    SELECT * FROM dwh.factSmartauditsCategories
                    WHERE CONVERT(date, COALESCE(ReviewAIDate, ReviewDate, SourceLastChangedAt)) BETWEEN ? AND ?
                )
                SELECT TOP (100) p.LocationId,
                       COALESCE(p.LocationName,N'UBICACION_SIN_NOMBRE') AS LocationName,
                       COUNT_BIG(*) AS ResultCount,
                       COUNT_BIG(DISTINCT p.[Task]) AS TaskCount,
                       SUM(CASE WHEN p.ResultCategory<>N'CUMPLIMIENTO' THEN 1 ELSE 0 END) AS NonComplianceResults,
                       CAST(100.0*SUM(CASE WHEN p.ResultCategory=N'CUMPLIMIENTO' THEN 1 ELSE 0 END)/NULLIF(COUNT_BIG(*),0) AS float) AS ComplianceRate,
                       CAST(100.0*SUM(p.FailedEvidenceCount)/NULLIF(SUM(p.EvidenceCount),0) AS float) AS EvidenceFailureRate,
                       SUM(CASE WHEN p.ResultCategory IN (N'IMAGEN_NO_LEGIBLE',N'IMAGEN_NO_PROCESABLE') THEN 1 ELSE 0 END) AS ImageQualityIssues,
                       SUM(CASE WHEN p.ResultCategory=N'SIN_CLASIFICAR' THEN 1 ELSE 0 END) AS UnclassifiedResults,
                       top_issue.ResultCategory AS TopIssueCategory,
                       COALESCE(top_issue.IssueCount,0) AS TopIssueCount
                FROM period p
                OUTER APPLY (
                    SELECT TOP (1) issue.ResultCategory, COUNT_BIG(*) AS IssueCount
                    FROM period issue
                    WHERE ((issue.LocationId=p.LocationId) OR (issue.LocationId IS NULL AND p.LocationId IS NULL))
                      AND issue.ResultCategory<>N'CUMPLIMIENTO'
                    GROUP BY issue.ResultCategory
                    ORDER BY COUNT_BIG(*) DESC, issue.ResultCategory
                ) top_issue
                GROUP BY p.LocationId, COALESCE(p.LocationName,N'UBICACION_SIN_NOMBRE'), top_issue.ResultCategory, top_issue.IssueCount
                ORDER BY NonComplianceResults DESC, ResultCount DESC, LocationName
                """,
        (rs, row) ->
            new SmartAuditsDashboard.Location(
                rs.getString("LocationId"),
                rs.getString("LocationName"),
                rs.getLong("ResultCount"),
                rs.getLong("TaskCount"),
                rs.getLong("NonComplianceResults"),
                nullableDouble(rs, "ComplianceRate"),
                nullableDouble(rs, "EvidenceFailureRate"),
                rs.getLong("ImageQualityIssues"),
                rs.getLong("UnclassifiedResults"),
                rs.getString("TopIssueCategory"),
                rs.getLong("TopIssueCount")),
        Date.valueOf(from),
        Date.valueOf(to));
  }

  private List<SmartAuditsDashboard.RecurrentIssue> recurrentIssues(
      JdbcTemplate jdbc, LocalDate from, LocalDate to) {
    return jdbc.query(
        """
                WITH period AS (
                    SELECT *, CONVERT(date,COALESCE(ReviewAIDate,ReviewDate,SourceLastChangedAt)) AS AuditDate
                    FROM dwh.factSmartauditsCategories
                    WHERE CONVERT(date, COALESCE(ReviewAIDate, ReviewDate, SourceLastChangedAt)) BETWEEN ? AND ?
                )
                SELECT TOP (100) LocationId,COALESCE(LocationName,N'UBICACION_SIN_NOMBRE') AS LocationName,
                       SublocationId,COALESCE(SublocationName,N'SUBUBICACION_SIN_NOMBRE') AS SublocationName,
                       [Task] AS TaskId,COALESCE(TaskName,N'TAREA_SIN_NOMBRE') AS TaskName,ResultCategory,
                       COUNT_BIG(*) AS RecurrenceCount,COUNT_BIG(DISTINCT WorkPlanId) AS WorkPlanCount,
                       SUM(FailedEvidenceCount) AS FailedEvidenceCount,MIN(AuditDate) AS FirstDate,MAX(AuditDate) AS LastDate
                FROM period
                WHERE ResultCategory<>N'CUMPLIMIENTO'
                GROUP BY LocationId,LocationName,SublocationId,SublocationName,[Task],TaskName,ResultCategory
                HAVING COUNT_BIG(*)>=2
                ORDER BY RecurrenceCount DESC,FailedEvidenceCount DESC,LastDate DESC
                """,
        (rs, row) ->
            new SmartAuditsDashboard.RecurrentIssue(
                rs.getString("LocationId"),
                rs.getString("LocationName"),
                rs.getString("SublocationId"),
                rs.getString("SublocationName"),
                rs.getString("TaskId"),
                rs.getString("TaskName"),
                rs.getString("ResultCategory"),
                rs.getLong("RecurrenceCount"),
                rs.getLong("WorkPlanCount"),
                rs.getLong("FailedEvidenceCount"),
                localDate(rs.getDate("FirstDate")),
                localDate(rs.getDate("LastDate"))),
        Date.valueOf(from),
        Date.valueOf(to));
  }

  private boolean exists(JdbcTemplate jdbc, String objectName) {
    Integer value =
        jdbc.queryForObject(
            "SELECT CASE WHEN OBJECT_ID(?,N'U') IS NULL THEN 0 ELSE 1 END",
            Integer.class,
            objectName);
    return value != null && value == 1;
  }

  private Double nullableDouble(ResultSet rs, String column) throws SQLException {
    double value = rs.getDouble(column);
    return rs.wasNull() ? null : value;
  }

  private Instant instant(Timestamp value) {
    return value == null ? null : value.toLocalDateTime().toInstant(ZoneOffset.UTC);
  }

  private LocalDate localDate(Date value) {
    return value == null ? null : value.toLocalDate();
  }
}
