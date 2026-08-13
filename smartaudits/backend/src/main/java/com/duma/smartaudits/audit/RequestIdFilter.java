package com.duma.smartaudits.audit;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.security.Principal;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class RequestIdFilter extends OncePerRequestFilter {
  public static final String ATTRIBUTE = "duma.requestId";
  private static final Pattern SAFE = Pattern.compile("^[A-Za-z0-9._-]{1,64}$");
  private final SystemLogService logs;

  public RequestIdFilter(SystemLogService logs) {
    this.logs = logs;
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    String incoming = request.getHeader("X-Request-Id");
    String requestId =
        incoming != null && SAFE.matcher(incoming).matches()
            ? incoming
            : UUID.randomUUID().toString();
    request.setAttribute(ATTRIBUTE, requestId);
    response.setHeader("X-Request-Id", requestId);
    long start = System.nanoTime();
    try {
      chain.doFilter(request, response);
    } finally {
      Principal principal = request.getUserPrincipal();
      logs.recordRequest(
          request.getMethod(),
          request.getRequestURI(),
          response.getStatus(),
          (System.nanoTime() - start) / 1_000_000,
          requestId,
          principal == null ? null : principal.getName(),
          request.getRemoteAddr(),
          request.getHeader("User-Agent"));
    }
  }

  public static String get(HttpServletRequest request) {
    Object value = request.getAttribute(ATTRIBUTE);
    return value == null ? null : value.toString();
  }
}
