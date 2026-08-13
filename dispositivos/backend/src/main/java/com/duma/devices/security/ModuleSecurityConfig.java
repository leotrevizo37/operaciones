package com.duma.devices.security;

import com.duma.devices.config.ModuleProperties;
import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
public class ModuleSecurityConfig {
  @Bean
  SecurityFilterChain securityFilterChain(HttpSecurity http, ModuleProperties p) throws Exception {
    http.csrf(c -> c.disable())
        .cors(Customizer.withDefaults())
        .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS));
    if (p.getSecurity().isStandaloneMode())
      http.authorizeHttpRequests(a -> a.anyRequest().permitAll());
    else
      http.authorizeHttpRequests(
              a ->
                  a.requestMatchers(
                          "/",
                          "/index.html",
                          "/assets/**",
                          "/remote-entry.js",
                          "/api/module/manifest",
                          "/actuator/health")
                      .permitAll()
                      .requestMatchers("/api/**")
                      .authenticated()
                      .anyRequest()
                      .permitAll())
          .oauth2ResourceServer(r -> r.jwt(Customizer.withDefaults()));
    return http.build();
  }

  @Bean
  JwtDecoder jwtDecoder(ModuleProperties p) {
    NimbusJwtDecoder d = NimbusJwtDecoder.withJwkSetUri(p.getSecurity().getJwkSetUri()).build();
    OAuth2TokenValidator<Jwt> issuer =
        JwtValidators.createDefaultWithIssuer(p.getSecurity().getIssuer());
    OAuth2TokenValidator<Jwt> audience =
        j ->
            j.getAudience().contains(p.getModule().getId())
                ? OAuth2TokenValidatorResult.success()
                : OAuth2TokenValidatorResult.failure(
                    new OAuth2Error("invalid_token", "Audiencia de modulo invalida.", null));
    d.setJwtValidator(new DelegatingOAuth2TokenValidator<>(issuer, audience));
    return d;
  }

  @Bean
  CorsConfigurationSource corsConfigurationSource(ModuleProperties p) {
    CorsConfiguration c = new CorsConfiguration();
    c.setAllowedOrigins(p.getSecurity().getAllowedOrigins());
    c.setAllowedMethods(List.of("GET", "POST", "OPTIONS"));
    c.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-Request-Id"));
    c.setExposedHeaders(List.of("X-Request-Id"));
    c.setAllowCredentials(false);
    UrlBasedCorsConfigurationSource s = new UrlBasedCorsConfigurationSource();
    s.registerCorsConfiguration("/**", c);
    return s;
  }
}
