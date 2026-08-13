package com.duma.smartaudits.audit;

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
  private static final String APP = "smartaudits";
  private final JdbcTemplate jdbc;

  public SystemLogService(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @Async
  public void recordRequest(
      String method,
      String uri,
      int status,
      long duration,
      String requestId,
      String actor,
      String sourceIp,
      String userAgent) {
    record(
        "HTTP_REQUEST",
        method + " " + cut(uri, 300),
        status < 400 ? "SUCCESS" : "FAILURE",
        status >= 500 ? "ERROR" : status >= 400 ? "WARNING" : "INFO",
        requestId,
        actor,
        null,
        duration,
        sourceIp,
        userAgent);
  }

  public void recordClient(
      String name,
      String outcome,
      String actor,
      String tenant,
      Long duration,
      HttpServletRequest request) {
    record(
        "CLIENT_TELEMETRY",
        name,
        outcome,
        "CLIENT_ERROR".equals(name) ? "WARNING" : "INFO",
        RequestIdFilter.get(request),
        actor,
        tenant,
        duration,
        request.getRemoteAddr(),
        request.getHeader("User-Agent"));
  }

  public void recordApproval(String actor, boolean idempotent, HttpServletRequest request) {
    record(
        "BUSINESS_ACTION",
        "SMARTAUDITS_REVIEW_APPROVED",
        "SUCCESS",
        "INFO",
        RequestIdFilter.get(request),
        actor,
        "carlsjr",
        null,
        request.getRemoteAddr(),
        request.getHeader("User-Agent"));
    if (idempotent) {
      log.info("smartaudits_approval_idempotent tenant=carlsjr");
    }
  }

  private void record(
      String type,
      String name,
      String outcome,
      String severity,
      String requestId,
      String actor,
      String tenant,
      Long duration,
      String ip,
      String userAgent) {
    try {
      jdbc.update(
          "EXEC audit.usp_RecordSystemEvent @ApplicationId=?, @EventType=?, @EventName=?, @Outcome=?, @Severity=?, @RequestId=?, @ActorId=?, @TenantId=?, @DurationMs=?, @SourceIp=?, @UserAgent=?, @MetadataJson=?",
          APP,
          cut(type, 80),
          cut(name, 300),
          cut(outcome, 30),
          cut(severity, 20),
          cut(requestId, 64),
          cut(actor, 255),
          cut(tenant, 80),
          duration,
          cut(ip, 64),
          cut(userAgent, 512),
          null);
    } catch (DataAccessException exception) {
      log.warn(
          "system_log_write_failed applicationId={} eventType={} eventName={}", APP, type, name);
    }
  }

  private String cut(String value, int max) {
    if (value == null || value.isBlank()) {
      return null;
    }
    return value.length() <= max ? value : value.substring(0, max);
  }
}
