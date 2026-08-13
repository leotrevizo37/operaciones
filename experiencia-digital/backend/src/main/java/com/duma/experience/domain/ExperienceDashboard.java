package com.duma.experience.domain;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public final class ExperienceDashboard {

  private ExperienceDashboard() {}

  public record Response(
      Instant generatedAt, LocalDate from, LocalDate to, List<TenantResult> tenants) {}

  public record TenantResult(
      String tenantId,
      String tenantName,
      CoverageStatus coverageStatus,
      List<String> missingSources,
      PeriodMetrics current,
      PeriodMetrics previous,
      String errorCode) {}

  public record PeriodMetrics(UserMetrics users, AvailabilityMetrics availability) {
    public long observedRows() {
      return users.evaluatedUserDays() + availability.observedServiceDays();
    }
  }

  public record UserMetrics(
      long evaluatedUserDays,
      long sessionUserDays,
      long completeInteractions,
      Double avgSessionSeconds,
      Double avgLatencyMs,
      Double maxP95LatencyMs,
      long slowUserDays) {
    public static UserMetrics empty() {
      return new UserMetrics(0, 0, 0, null, null, null, 0);
    }
  }

  public record AvailabilityMetrics(
      long observedServiceDays,
      Double avgUptimePercentage,
      Double avgLatencySeconds,
      Double maxP95LatencySeconds,
      long timeoutDays,
      long currentDownServices,
      LocalDate latestDate) {
    public static AvailabilityMetrics empty() {
      return new AvailabilityMetrics(0, null, null, null, 0, 0, null);
    }
  }
}
