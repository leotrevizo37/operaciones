package com.duma.experience.config;

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
    private String id = "experiencia-digital";
    private String displayName = "Experiencia digital";
    private String customElement = "duma-experience-module";
    private String remoteEntryUrl = "http://localhost:8081/remote-entry.js";
    private String apiBaseUrl = "http://localhost:8081";
    private String releaseStage = "DEVELOPMENT";
    private String dataEnvironment = "PRODUCTION";
    private String freshnessMode = "LIVE";
    private String clearance = "ACADEMIC_PRIVATE";
    private String tenantScope = "ALL_TENANTS";
    private List<String> capabilities =
        new ArrayList<>(List.of("dashboard", "tenant-coverage", "drilldown"));

    public String getId() {
      return id;
    }

    public void setId(String id) {
      this.id = id;
    }

    public String getDisplayName() {
      return displayName;
    }

    public void setDisplayName(String displayName) {
      this.displayName = displayName;
    }

    public String getCustomElement() {
      return customElement;
    }

    public void setCustomElement(String customElement) {
      this.customElement = customElement;
    }

    public String getRemoteEntryUrl() {
      return remoteEntryUrl;
    }

    public void setRemoteEntryUrl(String remoteEntryUrl) {
      this.remoteEntryUrl = remoteEntryUrl;
    }

    public String getApiBaseUrl() {
      return apiBaseUrl;
    }

    public void setApiBaseUrl(String apiBaseUrl) {
      this.apiBaseUrl = apiBaseUrl;
    }

    public String getReleaseStage() {
      return releaseStage;
    }

    public void setReleaseStage(String releaseStage) {
      this.releaseStage = releaseStage;
    }

    public String getDataEnvironment() {
      return dataEnvironment;
    }

    public void setDataEnvironment(String dataEnvironment) {
      this.dataEnvironment = dataEnvironment;
    }

    public String getFreshnessMode() {
      return freshnessMode;
    }

    public void setFreshnessMode(String freshnessMode) {
      this.freshnessMode = freshnessMode;
    }

    public String getClearance() {
      return clearance;
    }

    public void setClearance(String clearance) {
      this.clearance = clearance;
    }

    public String getTenantScope() {
      return tenantScope;
    }

    public void setTenantScope(String tenantScope) {
      this.tenantScope = tenantScope;
    }

    public List<String> getCapabilities() {
      return capabilities;
    }

    public void setCapabilities(List<String> capabilities) {
      this.capabilities = capabilities;
    }
  }

  public static class Warehouse {
    private String host = "localhost";
    private int port = 1433;
    private String username;
    private String password;
    private boolean encrypt = true;
    private boolean trustServerCertificate;
    private int poolSizePerTenant = 2;

    public String getHost() {
      return host;
    }

    public void setHost(String host) {
      this.host = host;
    }

    public int getPort() {
      return port;
    }

    public void setPort(int port) {
      this.port = port;
    }

    public String getUsername() {
      return username;
    }

    public void setUsername(String username) {
      this.username = username;
    }

    public String getPassword() {
      return password;
    }

    public void setPassword(String password) {
      this.password = password;
    }

    public boolean isEncrypt() {
      return encrypt;
    }

    public void setEncrypt(boolean encrypt) {
      this.encrypt = encrypt;
    }

    public boolean isTrustServerCertificate() {
      return trustServerCertificate;
    }

    public void setTrustServerCertificate(boolean trustServerCertificate) {
      this.trustServerCertificate = trustServerCertificate;
    }

    public int getPoolSizePerTenant() {
      return poolSizePerTenant;
    }

    public void setPoolSizePerTenant(int poolSizePerTenant) {
      this.poolSizePerTenant = poolSizePerTenant;
    }
  }

  public static class Security {
    private String issuer = "http://localhost:8080";
    private String jwkSetUri = "http://localhost:8080/api/integration/jwks";
    private boolean standaloneMode;
    private List<String> allowedOrigins =
        new ArrayList<>(
            List.of("http://localhost:8080", "http://localhost:5173", "http://localhost:5174"));

    public String getIssuer() {
      return issuer;
    }

    public void setIssuer(String issuer) {
      this.issuer = issuer;
    }

    public String getJwkSetUri() {
      return jwkSetUri;
    }

    public void setJwkSetUri(String jwkSetUri) {
      this.jwkSetUri = jwkSetUri;
    }

    public boolean isStandaloneMode() {
      return standaloneMode;
    }

    public void setStandaloneMode(boolean standaloneMode) {
      this.standaloneMode = standaloneMode;
    }

    public List<String> getAllowedOrigins() {
      return allowedOrigins;
    }

    public void setAllowedOrigins(List<String> allowedOrigins) {
      this.allowedOrigins = allowedOrigins;
    }
  }

  public static class Tenant {
    private String displayName;
    private String database;
    private String host;
    private Integer port;
    private String username;
    private String password;
    private Boolean encrypt;
    private Boolean trustServerCertificate;
    private Integer poolSizePerTenant;
    private boolean enabled = true;

    public String getDisplayName() {
      return displayName;
    }

    public void setDisplayName(String displayName) {
      this.displayName = displayName;
    }

    public String getDatabase() {
      return database;
    }

    public void setDatabase(String database) {
      this.database = database;
    }

    public String getHost() {
      return host;
    }

    public void setHost(String host) {
      this.host = host;
    }

    public Integer getPort() {
      return port;
    }

    public void setPort(Integer port) {
      this.port = port;
    }

    public String getUsername() {
      return username;
    }

    public void setUsername(String username) {
      this.username = username;
    }

    public String getPassword() {
      return password;
    }

    public void setPassword(String password) {
      this.password = password;
    }

    public Boolean getEncrypt() {
      return encrypt;
    }

    public void setEncrypt(Boolean encrypt) {
      this.encrypt = encrypt;
    }

    public Boolean getTrustServerCertificate() {
      return trustServerCertificate;
    }

    public void setTrustServerCertificate(Boolean trustServerCertificate) {
      this.trustServerCertificate = trustServerCertificate;
    }

    public Integer getPoolSizePerTenant() {
      return poolSizePerTenant;
    }

    public void setPoolSizePerTenant(Integer poolSizePerTenant) {
      this.poolSizePerTenant = poolSizePerTenant;
    }

    public boolean isEnabled() {
      return enabled;
    }

    public void setEnabled(boolean enabled) {
      this.enabled = enabled;
    }
  }
}
