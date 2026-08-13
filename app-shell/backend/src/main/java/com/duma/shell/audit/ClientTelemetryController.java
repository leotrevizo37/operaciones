package com.duma.shell.audit;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.Set;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/telemetry")
public class ClientTelemetryController {

  private static final Set<String> EVENT_NAMES =
      Set.of(
          "MODULE_LOADED",
          "VIEW_RENDERED",
          "FILTER_APPLIED",
          "DRILLDOWN_OPENED",
          "EMPTY_STATE_SHOWN",
          "CLIENT_ERROR");
  private static final Set<String> OUTCOMES = Set.of("SUCCESS", "FAILURE", "CANCELLED");
  private final SystemLogService systemLogService;

  public ClientTelemetryController(SystemLogService systemLogService) {
    this.systemLogService = systemLogService;
  }

  @PostMapping
  public ResponseEntity<Void> record(
      @Valid @RequestBody TelemetryRequest telemetryRequest,
      Authentication authentication,
      HttpServletRequest request) {
    if (!EVENT_NAMES.contains(telemetryRequest.eventName())
        || !OUTCOMES.contains(telemetryRequest.outcome())) {
      return ResponseEntity.unprocessableEntity().build();
    }
    systemLogService.recordClientEvent(
        new SystemLogService.ClientTelemetryEvent(
            telemetryRequest.moduleId(),
            telemetryRequest.eventName(),
            telemetryRequest.outcome(),
            telemetryRequest.tenantId(),
            telemetryRequest.durationMs()),
        authentication.getName(),
        request);
    return ResponseEntity.accepted().build();
  }

  public record TelemetryRequest(
      @NotBlank @Pattern(regexp = "^[a-z][a-z0-9-]{1,79}$") String moduleId,
      @NotBlank @Size(max = 80) String eventName,
      @NotBlank @Size(max = 30) String outcome,
      @Size(max = 80) String tenantId,
      @Min(0) @Max(86_400_000) Long durationMs) {}
}
