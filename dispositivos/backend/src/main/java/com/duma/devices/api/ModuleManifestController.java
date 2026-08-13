package com.duma.devices.api;

import com.duma.devices.config.ModuleProperties;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/module")
public class ModuleManifestController {
  private final ModuleProperties p;

  public ModuleManifestController(ModuleProperties p) {
    this.p = p;
  }

  @GetMapping("/manifest")
  public Manifest manifest() {
    ModuleProperties.Module m = p.getModule();
    return new Manifest(
        "1.0",
        m.getId(),
        m.getDisplayName(),
        m.getCustomElement(),
        m.getRemoteEntryUrl(),
        m.getApiBaseUrl(),
        m.getReleaseStage(),
        m.getDataEnvironment(),
        m.getFreshnessMode(),
        m.getClearance(),
        m.getTenantScope(),
        m.getCapabilities());
  }

  public record Manifest(
      String protocolVersion,
      String moduleId,
      String displayName,
      String customElement,
      String remoteEntryUrl,
      String apiBaseUrl,
      String releaseStage,
      String dataEnvironment,
      String freshnessMode,
      String clearance,
      String tenantScope,
      List<String> capabilities) {}
}
