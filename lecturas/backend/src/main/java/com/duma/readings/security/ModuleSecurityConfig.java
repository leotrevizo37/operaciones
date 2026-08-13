package com.duma.readings.security;

import com.duma.readings.config.ModuleProperties;
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
  SecurityFilterChain securityFilterChain(HttpSecurity http, ModuleProperties properties)
      throws Exception {
    http.csrf(csrf -> csrf.disable())
        .cors(Customizer.withDefaults())
        .sessionManagement(
            session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS));
    if (properties.getSecurity().isStandaloneMode())
      http.authorizeHttpRequests(authorize -> authorize.anyRequest().permitAll());
    else
      http.authorizeHttpRequests(
              authorize ->
                  authorize
                      .requestMatchers(
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
          .oauth2ResourceServer(resource -> resource.jwt(Customizer.withDefaults()));
    return http.build();
  }

  @Bean
  JwtDecoder jwtDecoder(ModuleProperties properties) {
    NimbusJwtDecoder decoder =
        NimbusJwtDecoder.withJwkSetUri(properties.getSecurity().getJwkSetUri()).build();
    OAuth2TokenValidator<Jwt> issuer =
        JwtValidators.createDefaultWithIssuer(properties.getSecurity().getIssuer());
    OAuth2TokenValidator<Jwt> audience =
        jwt ->
            jwt.getAudience().contains(properties.getModule().getId())
                ? OAuth2TokenValidatorResult.success()
                : OAuth2TokenValidatorResult.failure(
                    new OAuth2Error("invalid_token", "Audiencia de modulo invalida.", null));
    decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(issuer, audience));
    return decoder;
  }

  @Bean
  CorsConfigurationSource corsConfigurationSource(ModuleProperties properties) {
    CorsConfiguration configuration = new CorsConfiguration();
    configuration.setAllowedOrigins(properties.getSecurity().getAllowedOrigins());
    configuration.setAllowedMethods(List.of("GET", "POST", "OPTIONS"));
    configuration.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-Request-Id"));
    configuration.setExposedHeaders(List.of("X-Request-Id"));
    configuration.setAllowCredentials(false);
    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", configuration);
    return source;
  }
}
