package com.duma.shell.security;

import static org.springframework.http.HttpStatus.NOT_FOUND;

import com.duma.shell.config.DumaProperties;
import com.nimbusds.jose.jwk.RSAKey;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import java.time.Duration;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/integration")
public class IntegrationController {

  private final DumaProperties properties;
  private final ModuleTokenService moduleTokenService;
  private final RSAKey rsaKey;

  public IntegrationController(
      DumaProperties properties, ModuleTokenService moduleTokenService, RSAKey rsaKey) {
    this.properties = properties;
    this.moduleTokenService = moduleTokenService;
    this.rsaKey = rsaKey;
  }

  @GetMapping("/jwks")
  public Map<String, Object> jwks() {
    return Map.of("keys", java.util.List.of(rsaKey.toPublicJWK().toJSONObject()));
  }

  @PostMapping("/token")
  public ResponseEntity<TokenResponse> token(
      @Valid @RequestBody TokenRequest tokenRequest,
      Authentication authentication,
      HttpServletRequest request) {
    if (!properties.getModules().containsKey(tokenRequest.moduleId())) {
      throw new ResponseStatusException(NOT_FOUND, "El modulo solicitado no esta registrado.");
    }
    DumaUserPrincipal principal = (DumaUserPrincipal) authentication.getPrincipal();
    ModuleTokenService.Token token =
        moduleTokenService.issue(
            tokenRequest.moduleId(), principal, request.getSession(false).getId());
    long expiresIn = Duration.between(java.time.Instant.now(), token.expiresAt()).toSeconds();
    return ResponseEntity.ok(new TokenResponse(token.value(), "Bearer", expiresIn));
  }

  public record TokenRequest(
      @NotBlank @Pattern(regexp = "^[a-z][a-z0-9-]{1,79}$") String moduleId) {}

  public record TokenResponse(String accessToken, String tokenType, long expiresIn) {}
}
