package com.duma.shell.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.core.io.ClassPathResource;

class PortConfigurationTest {

  @Test
  void resolvesCanonicalBackendPortsIntoServerAndModuleUrls() throws Exception {
    String shellPort = System.getProperty("DUMA_SHELL_BACKEND_PORT");
    String experiencePort = System.getProperty("DUMA_EXPERIENCE_BACKEND_PORT");
    try {
      System.setProperty("DUMA_SHELL_BACKEND_PORT", "19080");
      System.setProperty("DUMA_EXPERIENCE_BACKEND_PORT", "19081");
      StandardEnvironment environment = environment();

      assertThat(environment.getProperty("server.port")).isEqualTo("19080");
      assertThat(environment.getProperty("duma.security.issuer"))
          .isEqualTo("http://localhost:19080");
      assertThat(environment.getProperty("duma.modules.experiencia-digital.api-base-url"))
          .isEqualTo("http://localhost:19081");
      assertThat(environment.getProperty("duma.modules.experiencia-digital.remote-entry-url"))
          .isEqualTo("http://localhost:19081/remote-entry.js");
    } finally {
      restore("DUMA_SHELL_BACKEND_PORT", shellPort);
      restore("DUMA_EXPERIENCE_BACKEND_PORT", experiencePort);
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
