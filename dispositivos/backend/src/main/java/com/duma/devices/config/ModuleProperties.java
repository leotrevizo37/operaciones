package com.duma.devices.config;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "duma")
public class ModuleProperties {
  private final Module module = new Module();
  private final Warehouse warehouse = new Warehouse();
  private final Security security = new Security();
  private final Map<String, Tenant> tenants = new LinkedHashMap<>();

  public Module getModule() {
    return module;
  }

  public Warehouse getWarehouse() {
    return warehouse;
  }

  public Security getSecurity() {
    return security;
  }

  public Map<String, Tenant> getTenants() {
    return tenants;
  }

  public static class Module {
    private String id = "dispositivos",
        displayName = "Dispositivos",
        customElement = "duma-devices-module",
        remoteEntryUrl = "http://localhost:8083/remote-entry.js",
        apiBaseUrl = "http://localhost:8083",
        releaseStage = "DEVELOPMENT",
        dataEnvironment = "PRODUCTION",
        freshnessMode = "LIVE",
        clearance = "ACADEMIC_PRIVATE",
        tenantScope = "ALL_TENANTS";
    private List<String> capabilities =
        new ArrayList<>(List.of("dashboard", "tenant-coverage", "typed-equipment-detail"));

    public String getId() {
      return id;
    }

    public void setId(String v) {
      id = v;
    }

    public String getDisplayName() {
      return displayName;
    }

    public void setDisplayName(String v) {
      displayName = v;
    }

    public String getCustomElement() {
      return customElement;
    }

    public void setCustomElement(String v) {
      customElement = v;
    }

    public String getRemoteEntryUrl() {
      return remoteEntryUrl;
    }

    public void setRemoteEntryUrl(String v) {
      remoteEntryUrl = v;
    }

    public String getApiBaseUrl() {
      return apiBaseUrl;
    }

    public void setApiBaseUrl(String v) {
      apiBaseUrl = v;
    }

    public String getReleaseStage() {
      return releaseStage;
    }

    public void setReleaseStage(String v) {
      releaseStage = v;
    }

    public String getDataEnvironment() {
      return dataEnvironment;
    }

    public void setDataEnvironment(String v) {
      dataEnvironment = v;
    }

    public String getFreshnessMode() {
      return freshnessMode;
    }

    public void setFreshnessMode(String v) {
      freshnessMode = v;
    }

    public String getClearance() {
      return clearance;
    }

    public void setClearance(String v) {
      clearance = v;
    }

    public String getTenantScope() {
      return tenantScope;
    }

    public void setTenantScope(String v) {
      tenantScope = v;
    }

    public List<String> getCapabilities() {
      return capabilities;
    }

    public void setCapabilities(List<String> v) {
      capabilities = v;
    }
  }

  public static class Warehouse {
    private String host = "localhost", username, password;
    private int port = 1433, poolSizePerTenant = 2;
    private boolean encrypt = true, trustServerCertificate;

    public String getHost() {
      return host;
    }

    public void setHost(String v) {
      host = v;
    }

    public int getPort() {
      return port;
    }

    public void setPort(int v) {
      port = v;
    }

    public String getUsername() {
      return username;
    }

    public void setUsername(String v) {
      username = v;
    }

    public String getPassword() {
      return password;
    }

    public void setPassword(String v) {
      password = v;
    }

    public boolean isEncrypt() {
      return encrypt;
    }

    public void setEncrypt(boolean v) {
      encrypt = v;
    }

    public boolean isTrustServerCertificate() {
      return trustServerCertificate;
    }

    public void setTrustServerCertificate(boolean v) {
      trustServerCertificate = v;
    }

    public int getPoolSizePerTenant() {
      return poolSizePerTenant;
    }

    public void setPoolSizePerTenant(int v) {
      poolSizePerTenant = v;
    }
  }

  public static class Security {
    private String issuer = "http://localhost:8080",
        jwkSetUri = "http://localhost:8080/api/integration/jwks";
    private boolean standaloneMode;
    private List<String> allowedOrigins =
        new ArrayList<>(
            List.of("http://localhost:8080", "http://localhost:5173", "http://localhost:5176"));

    public String getIssuer() {
      return issuer;
    }

    public void setIssuer(String v) {
      issuer = v;
    }

    public String getJwkSetUri() {
      return jwkSetUri;
    }

    public void setJwkSetUri(String v) {
      jwkSetUri = v;
    }

    public boolean isStandaloneMode() {
      return standaloneMode;
    }

    public void setStandaloneMode(boolean v) {
      standaloneMode = v;
    }

    public List<String> getAllowedOrigins() {
      return allowedOrigins;
    }

    public void setAllowedOrigins(List<String> v) {
      allowedOrigins = v;
    }
  }

  public static class Tenant {
    private String displayName, database;
    private boolean enabled = true;

    public String getDisplayName() {
      return displayName;
    }

    public void setDisplayName(String v) {
      displayName = v;
    }

    public String getDatabase() {
      return database;
    }

    public void setDatabase(String v) {
      database = v;
    }

    public boolean isEnabled() {
      return enabled;
    }

    public void setEnabled(boolean v) {
      enabled = v;
    }
  }
}
