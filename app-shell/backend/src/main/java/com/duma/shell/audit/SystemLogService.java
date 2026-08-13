package com.duma.shell.audit;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Service
public class SystemLogService {

  private static final Logger log = LoggerFactory.getLogger(SystemLogService.class);
  private static final String APPLICATION_ID = "app-shell";
  private final JdbcTemplate jdbcTemplate;

  public SystemLogService(JdbcTemplate jdbcTemplate) {
    this.jdbcTemplate = jdbcTemplate;
  }

  @Async
  public void recordRequest(
      String method,
      String uri,
      int status,
      long durationMs,
      String requestId,
      String actor,
      String sourceIp,
      String userAgent) {
    record(
        "HTTP_REQUEST",
        method + " " + truncate(uri, 300),
        status < 400 ? "SUCCESS" : "FAILURE",
        status >= 500 ? "ERROR" : status >= 400 ? "WARNING" : "INFO",
        requestId,
        actor,
        null,
        durationMs,
        sourceIp,
        userAgent,
        null);
  }

  public void recordSecurityEvent(
      String eventName, String outcome, String actor, HttpServletRequest request) {
    record(
        "SECURITY",
        eventName,
        outcome,
        "DENIED".equals(outcome) ? "WARNING" : "INFO",
        RequestIdFilter.get(request),
        normalizeActor(actor),
        null,
        null,
        request.getRemoteAddr(),
        request.getHeader("User-Agent"),
        null);
  }

  public void recordClientEvent(
      ClientTelemetryEvent event, String actor, HttpServletRequest request) {
    String metadata = "{\"moduleId\":\"" + escapeJson(event.moduleId()) + "\"}";
    record(
        "CLIENT_TELEMETRY",
        event.eventName(),
        event.outcome(),
        "CLIENT_ERROR".equals(event.eventName()) ? "WARNING" : "INFO",
        RequestIdFilter.get(request),
        normalizeActor(actor),
        event.tenantId(),
        event.durationMs(),
        request.getRemoteAddr(),
        request.getHeader("User-Agent"),
        metadata);
  }

  public void recordBusinessEvent(
      String eventName,
      String outcome,
      String actor,
      String tenantId,
      String requestId,
      String metadataJson) {
    record(
        "BUSINESS_ACTION",
        eventName,
        outcome,
        "FAILURE".equals(outcome) ? "ERROR" : "INFO",
        requestId,
        normalizeActor(actor),
        tenantId,
        null,
        null,
        null,
        truncate(metadataJson, 4000));
  }

  private void record(
      String eventType,
      String eventName,
      String outcome,
      String severity,
      String requestId,
      String actor,
      String tenantId,
      Long durationMs,
      String sourceIp,
      String userAgent,
      String metadataJson) {
    try {
      jdbcTemplate.update(
          """
                EXEC audit.usp_RecordSystemEvent
                    @ApplicationId = ?,
                    @EventType = ?,
                    @EventName = ?,
                    @Outcome = ?,
                    @Severity = ?,
                    @RequestId = ?,
                    @ActorId = ?,
                    @TenantId = ?,
                    @DurationMs = ?,
                    @SourceIp = ?,
                    @UserAgent = ?,
                    @MetadataJson = ?
                """,
          APPLICATION_ID,
          truncate(eventType, 80),
          truncate(eventName, 300),
          truncate(outcome, 30),
          truncate(severity, 20),
          truncate(requestId, 64),
          truncate(actor, 255),
          truncate(tenantId, 80),
          durationMs,
          truncate(sourceIp, 64),
          truncate(userAgent, 512),
          truncate(metadataJson, 4000));
    } catch (DataAccessException exception) {
      log.warn(
          "system_log_write_failed applicationId={} eventType={} eventName={}",
          APPLICATION_ID,
          eventType,
          eventName);
    }
  }

  private String normalizeActor(String actor) {
    return actor == null ? null : actor.trim().toLowerCase(Locale.ROOT);
  }

  private String truncate(String value, int maxLength) {
    if (value == null || value.isBlank()) {
      return null;
    }
    return value.length() <= maxLength ? value : value.substring(0, maxLength);
  }

  private String escapeJson(String value) {
    if (value == null) {
      return "";
    }
    return value.replace("\\", "\\\\").replace("\"", "\\\"");
  }

  public record ClientTelemetryEvent(
      String moduleId, String eventName, String outcome, String tenantId, Long durationMs) {}
}
