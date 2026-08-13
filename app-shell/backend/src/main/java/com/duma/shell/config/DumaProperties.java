package com.duma.shell.config;

import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "duma")
public class DumaProperties {

  private final Security security = new Security();
  private final Map<String, Module> modules = new LinkedHashMap<>();

  public Security getSecurity() {
    return security;
  }

  public Map<String, Module> getModules() {
    return modules;
  }

  public static class Security {

    private String issuer = "http://localhost:8080";
    private Duration tokenTtl = Duration.ofMinutes(2);
    private String privateKeyBase64;
    private String publicKeyBase64;
    private boolean allowEphemeralKeys;

    public String getIssuer() {
      return issuer;
    }

    public void setIssuer(String issuer) {
      this.issuer = issuer;
    }

    public Duration getTokenTtl() {
      return tokenTtl;
    }

    public void setTokenTtl(Duration tokenTtl) {
      this.tokenTtl = tokenTtl;
    }

    public String getPrivateKeyBase64() {
      return privateKeyBase64;
    }

    public void setPrivateKeyBase64(String privateKeyBase64) {
      this.privateKeyBase64 = privateKeyBase64;
    }

    public String getPublicKeyBase64() {
      return publicKeyBase64;
    }

    public void setPublicKeyBase64(String publicKeyBase64) {
      this.publicKeyBase64 = publicKeyBase64;
    }

    public boolean isAllowEphemeralKeys() {
      return allowEphemeralKeys;
    }

    public void setAllowEphemeralKeys(boolean allowEphemeralKeys) {
      this.allowEphemeralKeys = allowEphemeralKeys;
    }
  }

  public static class Module {

    private String displayName;
    private String customElement;
    private String remoteEntryUrl;
    private String apiBaseUrl;
    private String releaseStage = "DEVELOPMENT";
    private String dataEnvironment = "PRODUCTION";
    private String freshnessMode = "LIVE";
    private String clearance = "ACADEMIC_PRIVATE";
    private String tenantScope = "ALL_TENANTS";
    private List<String> capabilities = new ArrayList<>();

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
}
