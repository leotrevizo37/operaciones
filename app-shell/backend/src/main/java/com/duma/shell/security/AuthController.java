package com.duma.shell.security;

import com.duma.shell.audit.SystemLogService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.security.web.authentication.session.ChangeSessionIdAuthenticationStrategy;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

  private final AuthenticationManager authenticationManager;
  private final HttpSessionSecurityContextRepository contextRepository =
      new HttpSessionSecurityContextRepository();
  private final ChangeSessionIdAuthenticationStrategy sessionStrategy =
      new ChangeSessionIdAuthenticationStrategy();
  private final SystemLogService systemLogService;

  public AuthController(
      AuthenticationManager authenticationManager, SystemLogService systemLogService) {
    this.authenticationManager = authenticationManager;
    this.systemLogService = systemLogService;
  }

  @GetMapping("/csrf")
  public CsrfResponse csrf(CsrfToken token) {
    return new CsrfResponse(token.getHeaderName(), token.getToken());
  }

  @GetMapping("/me")
  public SessionResponse me(Authentication authentication) {
    return response(authentication);
  }

  @PostMapping("/login")
  public ResponseEntity<SessionResponse> login(
      @Valid @RequestBody LoginRequest loginRequest,
      HttpServletRequest request,
      HttpServletResponse response) {
    try {
      Authentication authentication =
          authenticationManager.authenticate(
              UsernamePasswordAuthenticationToken.unauthenticated(
                  loginRequest.username().trim().toLowerCase(), loginRequest.password()));
      sessionStrategy.onAuthentication(authentication, request, response);
      SecurityContext context = SecurityContextHolder.createEmptyContext();
      context.setAuthentication(authentication);
      SecurityContextHolder.setContext(context);
      contextRepository.saveContext(context, request, response);
      systemLogService.recordSecurityEvent("LOGIN", "SUCCESS", authentication.getName(), request);
      return ResponseEntity.ok(response(authentication));
    } catch (AuthenticationException exception) {
      systemLogService.recordSecurityEvent("LOGIN", "DENIED", loginRequest.username(), request);
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
    }
  }

  @PostMapping("/logout")
  public ResponseEntity<Void> logout(
      Authentication authentication, HttpServletRequest request, HttpServletResponse response) {
    if (authentication != null) {
      systemLogService.recordSecurityEvent("LOGOUT", "SUCCESS", authentication.getName(), request);
    }
    new SecurityContextLogoutHandler().logout(request, response, authentication);
    return ResponseEntity.noContent().build();
  }

  private SessionResponse response(Authentication authentication) {
    DumaUserPrincipal principal = (DumaUserPrincipal) authentication.getPrincipal();
    return new SessionResponse(
        principal.username(),
        principal.displayName(),
        principal.roles(),
        principal.permissions(),
        principal.tenantScope());
  }

  public record LoginRequest(
      @NotBlank @Size(max = 255) String username, @NotBlank @Size(max = 512) String password) {}

  public record SessionResponse(
      String subject,
      String displayName,
      List<String> roles,
      List<String> permissions,
      List<String> tenantScope) {}

  public record CsrfResponse(String headerName, String token) {}
}
