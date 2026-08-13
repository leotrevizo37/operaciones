package com.duma.devices.api;

import com.duma.devices.config.ModuleProperties;
import com.duma.devices.data.DevicesRepository;
import com.duma.devices.domain.DevicesDashboard;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Arrays;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/devices")
public class DevicesController {
  private final ModuleProperties properties;
  private final DevicesRepository repository;

  public DevicesController(ModuleProperties p, DevicesRepository r) {
    properties = p;
    repository = r;
  }

  @GetMapping
  public DevicesDashboard.Response dashboard(
      @RequestParam(required = false) LocalDate from,
      @RequestParam(required = false) LocalDate to,
      @RequestParam(required = false) String tenant) {
    LocalDate effectiveTo = to == null ? LocalDate.now() : to,
        effectiveFrom = from == null ? effectiveTo.minusDays(30) : from;
    if (effectiveFrom.isAfter(effectiveTo))
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "El periodo solicitado no es valido.");
    if (ChronoUnit.DAYS.between(effectiveFrom, effectiveTo) > 366)
      throw new ResponseStatusException(
          HttpStatus.UNPROCESSABLE_ENTITY, "El periodo no puede exceder 367 dias.");
    List<DevicesDashboard.TenantResult> results =
        select(tenant).stream().map(id -> repository.load(id, effectiveFrom, effectiveTo)).toList();
    return new DevicesDashboard.Response(Instant.now(), effectiveFrom, effectiveTo, results);
  }

  private List<String> select(String tenant) {
    List<String> enabled =
        properties.getTenants().entrySet().stream()
            .filter(e -> e.getValue().isEnabled())
            .map(java.util.Map.Entry::getKey)
            .toList();
    if (tenant == null || tenant.isBlank()) return enabled;
    List<String> requested =
        Arrays.stream(tenant.split(","))
            .map(String::trim)
            .filter(v -> !v.isBlank())
            .distinct()
            .toList();
    if (requested.isEmpty() || requested.stream().anyMatch(v -> !enabled.contains(v)))
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Existe un tenant no valido o deshabilitado.");
    return enabled.stream().filter(requested::contains).toList();
  }
}
