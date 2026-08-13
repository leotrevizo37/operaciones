package com.duma.devices.domain;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public final class DevicesDashboard {
  private DevicesDashboard() {}

  public record Response(
      Instant generatedAt, LocalDate from, LocalDate to, List<TenantResult> tenants) {}

  public record TenantResult(
      String tenantId,
      String tenantName,
      CoverageStatus coverageStatus,
      List<String> missingSources,
      Summary current,
      Summary previous,
      List<Device> devices,
      String errorCode) {}

  public record Summary(
      long devicesObserved,
      Double avgHealthScore,
      long attentionDevices,
      long criticalDevices,
      long degradingDevices,
      Double avgFailureRiskScore,
      Double avgConfidenceScore,
      LocalDate latestDate,
      Instant latestModifiedAt) {
    public static Summary empty() {
      return new Summary(0, null, 0, 0, 0, null, null, null, null);
    }
  }

  public record Device(
      String deviceId,
      String locationId,
      String subLocationId,
      String deviceName,
      String deviceType,
      EquipmentKind equipmentKind,
      LocalDate localDate,
      Double healthScore,
      String operationalState,
      String worstHourlyState,
      long criticalHours,
      long degradedHours,
      long watchHours,
      Double sevenDayHealthScore,
      Double thirtyDayHealthScore,
      String trendDirection,
      Double confidenceScore,
      Double failureRiskScore,
      String dominantReasonCode,
      String recommendedAction,
      String evidenceJson,
      String featureSetVersion,
      String scoringVersion,
      String modelVersion,
      Instant modifiedAt) {}
}
