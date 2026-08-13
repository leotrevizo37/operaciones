package com.duma.readings.domain;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public final class ReadingsDashboard {
  private ReadingsDashboard() {}

  public record Response(
      Instant generatedAt, LocalDate from, LocalDate to, List<TenantResult> tenants) {}

  public record TenantResult(
      String tenantId,
      String tenantName,
      CoverageStatus coverageStatus,
      List<String> missingSources,
      Summary current,
      Summary previous,
      List<SensorException> exceptions,
      String errorCode) {}

  public record Summary(
      long sensorsObserved,
      long healthySensors,
      long disconnectedSensors,
      long lateSensors,
      Double avgMinutesWithoutReadings,
      Double maxMinutesWithoutReadings,
      Instant latestAuditAt,
      Instant latestReadingAt) {
    public static Summary empty() {
      return new Summary(0, 0, 0, 0, null, null, null, null);
    }
  }

  public record SensorException(
      String sensorId,
      String locationName,
      String deviceName,
      String sensorName,
      boolean disconnected,
      boolean late,
      Double minutesWithoutReadings,
      Instant auditAt,
      Instant lastReadingAt) {}
}
