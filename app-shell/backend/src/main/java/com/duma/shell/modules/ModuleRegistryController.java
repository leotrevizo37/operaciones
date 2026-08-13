package com.duma.shell.modules;

import com.duma.shell.config.DumaProperties;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/modules")
public class ModuleRegistryController {

  private final DumaProperties properties;

  public ModuleRegistryController(DumaProperties properties) {
    this.properties = properties;
  }

  @GetMapping
  public List<ModuleRegistration> modules() {
    return properties.getModules().entrySet().stream()
        .map(
            entry ->
                new ModuleRegistration(
                    entry.getKey(),
                    entry.getValue().getDisplayName(),
                    entry.getValue().getCustomElement(),
                    entry.getValue().getRemoteEntryUrl(),
                    entry.getValue().getApiBaseUrl(),
                    entry.getValue().getReleaseStage(),
                    entry.getValue().getDataEnvironment(),
                    entry.getValue().getFreshnessMode(),
                    entry.getValue().getClearance(),
                    entry.getValue().getTenantScope(),
                    List.copyOf(entry.getValue().getCapabilities())))
        .toList();
  }

  public record ModuleRegistration(
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
