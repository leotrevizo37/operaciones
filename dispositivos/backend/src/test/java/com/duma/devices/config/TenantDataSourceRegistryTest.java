package com.duma.devices.config;

import static org.assertj.core.api.Assertions.assertThat;

import com.zaxxer.hikari.HikariDataSource;
import org.junit.jupiter.api.Test;

class TenantDataSourceRegistryTest {

  @Test
  void usesTheTenantConnectionInsteadOfTheLegacyWarehouseFallback() {
    ModuleProperties properties = new ModuleProperties();
    properties.getWarehouse().setHost("warehouse-fallback");
    ModuleProperties.Tenant tenant = new ModuleProperties.Tenant();
    tenant.setDatabase("tenant_database");
    tenant.setHost("tenant-host");
    tenant.setPort(1444);
    tenant.setUsername("tenant-user");
    tenant.setPassword("tenant-password");
    tenant.setEncrypt(false);
    tenant.setTrustServerCertificate(true);
    tenant.setPoolSizePerTenant(3);
    properties.getTenants().put("carlsjr", tenant);

    TenantDataSourceRegistry registry = new TenantDataSourceRegistry(properties);
    HikariDataSource dataSource = (HikariDataSource) registry.jdbc("carlsjr").getDataSource();

    assertThat(dataSource.getJdbcUrl())
        .contains("//tenant-host:1444;databaseName=tenant_database;encrypt=false;trustServerCertificate=true");
    assertThat(dataSource.getUsername()).isEqualTo("tenant-user");
    assertThat(dataSource.getMaximumPoolSize()).isEqualTo(3);
    registry.close();
  }
}
