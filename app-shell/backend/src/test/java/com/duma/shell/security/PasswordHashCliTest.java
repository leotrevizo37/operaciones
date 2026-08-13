package com.duma.shell.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

class PasswordHashCliTest {
  @Test
  void createsABcryptHashAcceptedByTheShellEncoder() {
    String hash = PasswordHashCli.hash("local-password-not-a-secret");

    assertThat(hash).startsWith("$2");
    assertThat(new BCryptPasswordEncoder().matches("local-password-not-a-secret", hash)).isTrue();
  }
}
