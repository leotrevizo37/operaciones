package com.duma.shell.security;

import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
public class ShellUserDetailsService implements UserDetailsService {

  private final JdbcTemplate jdbcTemplate;

  public ShellUserDetailsService(JdbcTemplate jdbcTemplate) {
    this.jdbcTemplate = jdbcTemplate;
  }

  @Override
  public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
    try {
      return jdbcTemplate.queryForObject(
          """
                SELECT username, password_hash, display_name, enabled,
                       roles_csv, permissions_csv, tenant_scope_csv
                FROM security.app_user
                WHERE username = LOWER(?)
                """,
          (resultSet, rowNumber) ->
              new DumaUserPrincipal(
                  resultSet.getString("username"),
                  resultSet.getString("password_hash"),
                  resultSet.getString("display_name"),
                  resultSet.getBoolean("enabled"),
                  DumaUserPrincipal.csv(resultSet.getString("roles_csv")),
                  DumaUserPrincipal.csv(resultSet.getString("permissions_csv")),
                  DumaUserPrincipal.csv(resultSet.getString("tenant_scope_csv"))),
          username.trim().toLowerCase());
    } catch (EmptyResultDataAccessException exception) {
      throw new UsernameNotFoundException("Usuario no encontrado");
    }
  }
}
