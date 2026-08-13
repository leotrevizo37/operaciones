package com.duma.readings.data;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.duma.readings.config.ModuleProperties;
import com.duma.readings.config.TenantDataSourceRegistry;
import com.duma.readings.domain.CoverageStatus;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

class ReadingsRepositoryTest {
  @Test
  void reportsNotSupportedWhenRequiredFactIsMissing() {
    ModuleProperties properties = new ModuleProperties();
    ModuleProperties.Tenant tenant = new ModuleProperties.Tenant();
    tenant.setDisplayName("Tenant sin lecturas");
    tenant.setDatabase("warehouse");
    properties.getTenants().put("empty", tenant);
    TenantDataSourceRegistry registry = mock(TenantDataSourceRegistry.class);
    JdbcTemplate jdbc = mock(JdbcTemplate.class);
    when(registry.jdbc("empty")).thenReturn(jdbc);
    when(jdbc.queryForObject(anyString(), eq(Integer.class), any())).thenReturn(0);

    var result =
        new ReadingsRepository(properties, registry)
            .load("empty", LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 31));

    assertThat(result.coverageStatus()).isEqualTo(CoverageStatus.NOT_SUPPORTED);
    assertThat(result.missingSources()).contains("observability.factRedingsAudits");
    assertThat(result.current().sensorsObserved()).isZero();
    assertThat(result.errorCode()).isNull();
  }
}
