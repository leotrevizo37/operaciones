package com.duma.shell.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.testcontainers.containers.MSSQLServerContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ShellUserDetailsServiceIT {

  @Container
  private static final MSSQLServerContainer<?> SQL_SERVER =
      new MSSQLServerContainer<>("mcr.microsoft.com/mssql/server:2022-latest").acceptLicense();

  private JdbcTemplate jdbc;
  private ShellUserDetailsService service;

  @BeforeAll
  void createSchema() {
    DriverManagerDataSource dataSource =
        new DriverManagerDataSource(
            SQL_SERVER.getJdbcUrl(), SQL_SERVER.getUsername(), SQL_SERVER.getPassword());
    jdbc = new JdbcTemplate(dataSource);
    jdbc.execute("IF SCHEMA_ID(N'security') IS NULL EXEC(N'CREATE SCHEMA security')");
    jdbc.execute(
        """
                CREATE TABLE security.app_user(
                    username nvarchar(255) NOT NULL PRIMARY KEY,
                    password_hash nvarchar(255) NOT NULL,
                    display_name nvarchar(255) NOT NULL,
                    enabled bit NOT NULL,
                    roles_csv nvarchar(1000) NULL,
                    permissions_csv nvarchar(2000) NULL,
                    tenant_scope_csv nvarchar(1000) NULL
                )
                """);
    service = new ShellUserDetailsService(jdbc);
  }

  @BeforeEach
  void clearUsers() {
    jdbc.update("DELETE FROM security.app_user");
  }

  @Test
  void loadsPreparedAuthorizationContextFromSqlServer() {
    jdbc.update(
        """
                INSERT INTO security.app_user(
                    username,password_hash,display_name,enabled,roles_csv,permissions_csv,tenant_scope_csv)
                VALUES(N'investigador',N'hash-no-secreto',N'Investigador',1,
                       N'READER, REVIEWER',N'module:read, queue:promote',N'carlsjr, emerson')
                """);

    DumaUserPrincipal principal = (DumaUserPrincipal) service.loadUserByUsername("INVESTIGADOR");

    assertThat(principal.displayName()).isEqualTo("Investigador");
    assertThat(principal.roles()).containsExactly("READER", "REVIEWER");
    assertThat(principal.permissions()).containsExactly("module:read", "queue:promote");
    assertThat(principal.tenantScope()).containsExactly("carlsjr", "emerson");
    assertThat(principal.isEnabled()).isTrue();
  }

  @Test
  void rejectsUnknownDatabaseIdentity() {
    assertThatThrownBy(() -> service.loadUserByUsername("desconocido"))
        .isInstanceOf(UsernameNotFoundException.class);
  }
}
