package com.duma.shell.security;

import com.duma.shell.config.DumaProperties;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.proc.SecurityContext;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;
import java.util.UUID;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

@Configuration
public class RsaKeyConfiguration {

  @Bean
  RSAKey rsaKey(DumaProperties properties) {
    try {
      DumaProperties.Security security = properties.getSecurity();
      if (hasText(security.getPrivateKeyBase64()) && hasText(security.getPublicKeyBase64())) {
        KeyFactory factory = KeyFactory.getInstance("RSA");
        RSAPrivateKey privateKey =
            (RSAPrivateKey)
                factory.generatePrivate(
                    new PKCS8EncodedKeySpec(
                        Base64.getDecoder().decode(security.getPrivateKeyBase64())));
        RSAPublicKey publicKey =
            (RSAPublicKey)
                factory.generatePublic(
                    new X509EncodedKeySpec(
                        Base64.getDecoder().decode(security.getPublicKeyBase64())));
        return buildKey(publicKey, privateKey);
      }
      if (!security.isAllowEphemeralKeys()) {
        throw new IllegalStateException("Las llaves JWT del shell no estan configuradas.");
      }
      KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
      generator.initialize(2048);
      KeyPair keyPair = generator.generateKeyPair();
      return buildKey((RSAPublicKey) keyPair.getPublic(), (RSAPrivateKey) keyPair.getPrivate());
    } catch (IllegalStateException exception) {
      throw exception;
    } catch (Exception exception) {
      throw new IllegalStateException(
          "No fue posible inicializar las llaves JWT del shell.", exception);
    }
  }

  @Bean
  JwtEncoder jwtEncoder(RSAKey rsaKey) {
    JWKSource<SecurityContext> source = new ImmutableJWKSet<>(new JWKSet(rsaKey));
    return new NimbusJwtEncoder(source);
  }

  private RSAKey buildKey(RSAPublicKey publicKey, RSAPrivateKey privateKey) {
    return new RSAKey.Builder(publicKey)
        .privateKey(privateKey)
        .keyID(UUID.randomUUID().toString())
        .build();
  }

  private boolean hasText(String value) {
    return value != null && !value.isBlank();
  }
}
