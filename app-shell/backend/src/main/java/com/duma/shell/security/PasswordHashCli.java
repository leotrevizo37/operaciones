package com.duma.shell.security;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

public final class PasswordHashCli {
  private PasswordHashCli() {}

  public static void main(String[] args) throws Exception {
    String password =
        new BufferedReader(new InputStreamReader(System.in, StandardCharsets.UTF_8)).readLine();
    if (password == null || password.isBlank()) {
      System.exit(2);
    }
    System.out.print(hash(password));
  }

  static String hash(String password) {
    return new BCryptPasswordEncoder().encode(password);
  }
}
