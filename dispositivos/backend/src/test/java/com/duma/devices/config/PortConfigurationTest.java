package com.duma.devices.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.core.io.ClassPathResource;

class PortConfigurationTest {

  @Test
  void resolvesCanonicalPortsIntoServerUrlIssuerAndCors() throws Exception {
    String modulePort = System.getProperty("DUMA_DEVICES_BACKEND_PORT");
    String shellPort = System.getProperty("DUMA_SHELL_BACKEND_PORT");
    String frontendPort = System.getProperty("DUMA_DEVICES_FRONTEND_PORT");
    try {
      System.setProperty("DUMA_DEVICES_BACKEND_PORT", "19083");
      System.setProperty("DUMA_SHELL_BACKEND_PORT", "19080");
      System.setProperty("DUMA_DEVICES_FRONTEND_PORT", "15176");
      StandardEnvironment environment = environment();

      assertThat(environment.getProperty("server.port")).isEqualTo("19083");
      assertThat(environment.getProperty("duma.module.api-base-url"))
          .isEqualTo("http://localhost:19083");
      assertThat(environment.getProperty("duma.security.issuer"))
          .isEqualTo("http://localhost:19080");
      assertThat(environment.getProperty("duma.security.allowed-origins"))
          .contains("http://localhost:15176");
    } finally {
      restore("DUMA_DEVICES_BACKEND_PORT", modulePort);
      restore("DUMA_SHELL_BACKEND_PORT", shellPort);
      restore("DUMA_DEVICES_FRONTEND_PORT", frontendPort);
    }
  }

  private StandardEnvironment environment() throws Exception {
    StandardEnvironment environment = new StandardEnvironment();
    new YamlPropertySourceLoader()
        .load("application", new ClassPathResource("application.yml"))
        .forEach(environment.getPropertySources()::addLast);
    return environment;
  }

  private void restore(String key, String value) {
    if (value == null) System.clearProperty(key);
    else System.setProperty(key, value);
  }
}
