package com.duma.shell.security;

import static org.assertj.core.api.Assertions.assertThat;

import com.duma.shell.config.DumaProperties;
import com.nimbusds.jose.jwk.RSAKey;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;

class ModuleTokenServiceTest {
  @Test
  void issuesShortLivedAudienceScopedTokenWithPreparedAuthorizationClaims() throws Exception {
    DumaProperties properties = new DumaProperties();
    properties.getSecurity().setIssuer("https://shell.test");
    properties.getSecurity().setTokenTtl(Duration.ofMinutes(2));
    properties.getSecurity().setAllowEphemeralKeys(true);
    RsaKeyConfiguration keys = new RsaKeyConfiguration();
    RSAKey rsaKey = keys.rsaKey(properties);
    JwtEncoder encoder = keys.jwtEncoder(rsaKey);
    ModuleTokenService service = new ModuleTokenService(encoder, properties);
    DumaUserPrincipal principal =
        new DumaUserPrincipal(
            "investigador",
            "unused",
            "Investigador",
            true,
            List.of("READER"),
            List.of("future:permission"),
            List.of("carlsjr", "emerson"));

    ModuleTokenService.Token issued = service.issue("lecturas", principal, "session-1");
    Jwt decoded =
        NimbusJwtDecoder.withPublicKey(rsaKey.toRSAPublicKey()).build().decode(issued.value());

    assertThat(decoded.getIssuer().toString()).isEqualTo("https://shell.test");
    assertThat(decoded.getSubject()).isEqualTo("investigador");
    assertThat(decoded.getAudience()).containsExactly("lecturas");
    assertThat(decoded.getClaimAsStringList("roles")).containsExactly("READER");
    assertThat(decoded.getClaimAsStringList("permissions")).containsExactly("future:permission");
    assertThat(decoded.getClaimAsStringList("tenant_scope")).containsExactly("carlsjr", "emerson");
    assertThat(Duration.between(decoded.getIssuedAt(), decoded.getExpiresAt()))
        .isEqualTo(Duration.ofMinutes(2));
  }
}
