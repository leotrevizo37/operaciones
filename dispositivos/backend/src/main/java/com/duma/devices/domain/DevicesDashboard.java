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
      List<Device> daily,
      List<DeviceHour> hourly,
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
      Double eventMinutes,
      long openEvents,
      Double sevenDayHealthScore,
      Double thirtyDayHealthScore,
      String trendDirection,
      Double confidenceScore,
      Double peerPercentileRisk,
      Double failureRiskScore,
      String dominantReasonCode,
      String recommendedAction,
      String evidenceJson,
      String featureSetVersion,
      String scoringVersion,
      String modelVersion,
      Instant modifiedAt) {}

  public record DeviceHour(
      String deviceId,
      String locationId,
      String subLocationId,
      String deviceName,
      String deviceType,
      String localTimeSpan,
      Double healthScore,
      String operationalState,
      String trendDirection,
      Double confidenceScore,
      Double coverageScore,
      Double expectedValueComplianceScore,
      Double sensorReliabilityScore,
      Double eventStabilityScore,
      Double behaviorStabilityScore,
      Double peerAlignmentScore,
      Double failureRiskScore,
      String dominantReasonCode,
      String recommendedAction,
      String evidenceJson,
      String featureSetVersion,
      String scoringVersion,
      String modelVersion,
      Instant modifiedAt) {}

  public record DetailResponse(
      Instant generatedAt,
      DeviceKey device,
      List<OperationalHour> operationalHours,
      List<Measurement> measurements,
      List<SensorEvent> events,
      List<ReadingAudit> audits,
      List<Sensor> sensors) {}

  public record DeviceKey(
      String tenantId,
      String deviceId,
      String locationId,
      String subLocationId,
      LocalDate localDate) {}

  public record OperationalHour(
      String localTimeSpan,
      Double healthScore,
      String operationalState,
      String trendDirection,
      Double confidenceScore,
      Double coverageScore,
      Double expectedValueComplianceScore,
      Double sensorReliabilityScore,
      Double eventStabilityScore,
      Double behaviorStabilityScore,
      Double peerAlignmentScore,
      Double failureRiskScore,
      String dominantReasonCode,
      String recommendedAction,
      String evidenceJson,
      String featureSetVersion,
      String scoringVersion,
      String modelVersion) {}

  public record Measurement(
      String sensorId,
      String sensorName,
      String sensorType,
      String localTimeSpan,
      Double measurementValue,
      Double measurementStdDev,
      Long anomalies,
      Long readingsCount,
      Double expectedMin,
      Double expectedMax,
      String expectedSchedules,
      Boolean averageOutsideExpected,
      Instant modifiedAt) {}

  public record SensorEvent(
      String sensorId,
      String sensorName,
      String sensorType,
      String localTimeSpan,
      Double value,
      Double eventMinutes,
      boolean completed) {}

  public record ReadingAudit(
      String sensorId,
      String sensorName,
      String sensorType,
      String localTimeSpan,
      long readingsCount,
      boolean late,
      boolean connectionLost,
      Instant lastReadingAt,
      Instant connectionLostAt,
      Double minutesWithoutReadings) {}

  public record Sensor(
      String sensorId,
      String sensorName,
      String sensorType,
      boolean active,
      Double expectedMin,
      Double expectedMax,
      String startTime,
      String endTime,
      String scheduledDays) {}
}
