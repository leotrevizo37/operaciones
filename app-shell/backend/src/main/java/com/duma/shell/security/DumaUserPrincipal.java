package com.duma.shell.security;

import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

public record DumaUserPrincipal(
    String username,
    String passwordHash,
    String displayName,
    boolean enabled,
    List<String> roles,
    List<String> permissions,
    List<String> tenantScope)
    implements UserDetails {

  public static List<String> csv(String value) {
    if (value == null || value.isBlank()) {
      return List.of();
    }
    return Arrays.stream(value.split(","))
        .map(String::trim)
        .filter(item -> !item.isBlank())
        .distinct()
        .toList();
  }

  @Override
  public Collection<? extends GrantedAuthority> getAuthorities() {
    return roles.stream()
        .map(role -> role.startsWith("ROLE_") ? role : "ROLE_" + role)
        .map(SimpleGrantedAuthority::new)
        .toList();
  }

  @Override
  public String getPassword() {
    return passwordHash;
  }

  @Override
  public String getUsername() {
    return username;
  }

  @Override
  public boolean isEnabled() {
    return enabled;
  }
}
