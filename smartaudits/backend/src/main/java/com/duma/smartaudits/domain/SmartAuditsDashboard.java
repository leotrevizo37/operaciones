package com.duma.smartaudits.domain;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public final class SmartAuditsDashboard {
  private SmartAuditsDashboard() {}

  public record Response(
      Instant generatedAt, LocalDate from, LocalDate to, List<TenantResult> tenants) {}

  public record TenantResult(
      String tenantId,
      String tenantName,
      CoverageStatus coverageStatus,
      List<String> missingSources,
      Summary current,
      Summary previous,
      List<Category> categories,
      List<Location> locations,
      List<RecurrentIssue> recurrentIssues,
      String errorCode) {}

  public record Summary(
      long resultCount,
      long workPlanCount,
      long locationCount,
      long taskCount,
      long complianceResults,
      long nonComplianceResults,
      Double complianceRate,
      long evidenceCount,
      long failedEvidenceCount,
      Double evidenceFailureRate,
      long unclassifiedResults,
      Double classificationCoverageRate,
      long imageQualityIssues,
      long operationalIssues,
      Double avgClassifierConfidence,
      Double avgReviewLatencyMinutes,
      Instant latestSourceChangedAt,
      Instant latestModifiedAt) {
    public static Summary empty() {
      return new Summary(0, 0, 0, 0, 0, 0, null, 0, 0, null, 0, null, 0, 0, null, null, null, null);
    }
  }

  public record Category(
      String resultCategory,
      long resultCount,
      Double resultShare,
      long locationCount,
      long taskCount,
      Double avgClassifierConfidence) {}

  public record Location(
      String locationId,
      String locationName,
      long resultCount,
      long taskCount,
      long nonComplianceResults,
      Double complianceRate,
      Double evidenceFailureRate,
      long imageQualityIssues,
      long unclassifiedResults,
      String topIssueCategory,
      long topIssueCount) {}

  public record RecurrentIssue(
      String locationId,
      String locationName,
      String sublocationId,
      String sublocationName,
      String taskId,
      String taskName,
      String resultCategory,
      long recurrenceCount,
      long workPlanCount,
      long failedEvidenceCount,
      LocalDate firstDate,
      LocalDate lastDate) {}
}
