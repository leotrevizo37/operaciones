package com.duma.devices.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import jakarta.annotation.PreDestroy;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class TenantDataSourceRegistry {
  private final ModuleProperties properties;
  private final Map<String, HikariDataSource> dataSources = new LinkedHashMap<>();

  public TenantDataSourceRegistry(ModuleProperties properties) {
    this.properties = properties;
  }

  public JdbcTemplate jdbc(String id) {
    ModuleProperties.Tenant tenant = properties.getTenants().get(id);
    if (tenant == null
        || !tenant.isEnabled()
        || tenant.getDatabase() == null
        || tenant.getDatabase().isBlank())
      throw new IllegalArgumentException("Tenant no configurado.");
    return new JdbcTemplate(dataSources.computeIfAbsent(id, ignored -> create(id, tenant)));
  }

  private HikariDataSource create(String id, ModuleProperties.Tenant tenant) {
    ModuleProperties.Warehouse w = properties.getWarehouse();
    HikariConfig c = new HikariConfig();
    c.setPoolName("devices-" + id);
    c.setJdbcUrl(
        "jdbc:sqlserver://"
            + w.getHost()
            + ":"
            + w.getPort()
            + ";databaseName="
            + tenant.getDatabase()
            + ";encrypt="
            + w.isEncrypt()
            + ";trustServerCertificate="
            + w.isTrustServerCertificate());
    c.setUsername(w.getUsername());
    c.setPassword(w.getPassword());
    c.setMinimumIdle(0);
    c.setMaximumPoolSize(w.getPoolSizePerTenant());
    c.setConnectionTimeout(10_000);
    c.setValidationTimeout(5_000);
    c.setInitializationFailTimeout(-1);
    return new HikariDataSource(c);
  }

  @PreDestroy
  void close() {
    dataSources.values().forEach(HikariDataSource::close);
  }
}
