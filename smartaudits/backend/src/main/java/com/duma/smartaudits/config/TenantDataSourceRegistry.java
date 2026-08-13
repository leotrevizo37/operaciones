package com.duma.smartaudits.config;

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

  public JdbcTemplate jdbc(String tenantId) {
    ModuleProperties.Tenant tenant = properties.getTenants().get(tenantId);
    if (tenant == null
        || !tenant.isEnabled()
        || tenant.getDatabase() == null
        || tenant.getDatabase().isBlank()) {
      throw new IllegalArgumentException("Tenant no configurado.");
    }
    return new JdbcTemplate(
        dataSources.computeIfAbsent(tenantId, ignored -> create(tenantId, tenant)));
  }

  private HikariDataSource create(String tenantId, ModuleProperties.Tenant tenant) {
    ModuleProperties.Warehouse warehouse = properties.getWarehouse();
    HikariConfig config = new HikariConfig();
    config.setPoolName("smartaudits-" + tenantId);
    config.setJdbcUrl(
        "jdbc:sqlserver://"
            + warehouse.getHost()
            + ":"
            + warehouse.getPort()
            + ";databaseName="
            + tenant.getDatabase()
            + ";encrypt="
            + warehouse.isEncrypt()
            + ";trustServerCertificate="
            + warehouse.isTrustServerCertificate());
    config.setUsername(warehouse.getUsername());
    config.setPassword(warehouse.getPassword());
    config.setMinimumIdle(0);
    config.setMaximumPoolSize(warehouse.getPoolSizePerTenant());
    config.setConnectionTimeout(10_000);
    config.setValidationTimeout(5_000);
    config.setInitializationFailTimeout(-1);
    return new HikariDataSource(config);
  }

  @PreDestroy
  void close() {
    dataSources.values().forEach(HikariDataSource::close);
  }
}
