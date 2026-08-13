package com.duma.experience.audit;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Service
public class SystemLogService {

  private static final Logger log = LoggerFactory.getLogger(SystemLogService.class);
  private static final String APPLICATION_ID = "experiencia-digital";
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
        userAgent);
  }

  public void recordClientEvent(
      String eventName,
      String outcome,
      String actor,
      String tenantId,
      Long durationMs,
      HttpServletRequest request) {
    record(
        "CLIENT_TELEMETRY",
        eventName,
        outcome,
        "CLIENT_ERROR".equals(eventName) ? "WARNING" : "INFO",
        RequestIdFilter.get(request),
        actor,
        tenantId,
        durationMs,
        request.getRemoteAddr(),
        request.getHeader("User-Agent"));
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
      String userAgent) {
    try {
      jdbcTemplate.update(
          "EXEC audit.usp_RecordSystemEvent @ApplicationId=?, @EventType=?, @EventName=?, @Outcome=?, @Severity=?, @RequestId=?, @ActorId=?, @TenantId=?, @DurationMs=?, @SourceIp=?, @UserAgent=?, @MetadataJson=?",
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
          null);
    } catch (DataAccessException exception) {
      log.warn(
          "system_log_write_failed applicationId={} eventType={} eventName={}",
          APPLICATION_ID,
          eventType,
          eventName);
    }
  }

  private String truncate(String value, int maxLength) {
    if (value == null || value.isBlank()) return null;
    return value.length() <= maxLength ? value : value.substring(0, maxLength);
  }
}
