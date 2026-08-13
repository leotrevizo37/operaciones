package com.duma.shell.security;

import com.duma.shell.config.DumaProperties;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

@Service
public class ModuleTokenService {

  private final JwtEncoder jwtEncoder;
  private final DumaProperties properties;

  public ModuleTokenService(JwtEncoder jwtEncoder, DumaProperties properties) {
    this.jwtEncoder = jwtEncoder;
    this.properties = properties;
  }

  public Token issue(String moduleId, DumaUserPrincipal principal, String sessionId) {
    Instant issuedAt = Instant.now();
    Instant expiresAt = issuedAt.plus(properties.getSecurity().getTokenTtl());
    JwtClaimsSet claims =
        JwtClaimsSet.builder()
            .issuer(properties.getSecurity().getIssuer())
            .subject(principal.username())
            .audience(List.of(moduleId))
            .issuedAt(issuedAt)
            .expiresAt(expiresAt)
            .id(UUID.randomUUID().toString())
            .claim("display_name", principal.displayName())
            .claim("session_id", sessionId)
            .claim("roles", principal.roles())
            .claim("permissions", principal.permissions())
            .claim("tenant_scope", principal.tenantScope())
            .build();
    String value = jwtEncoder.encode(JwtEncoderParameters.from(claims)).getTokenValue();
    return new Token(value, expiresAt);
  }

  public record Token(String value, Instant expiresAt) {}
}
