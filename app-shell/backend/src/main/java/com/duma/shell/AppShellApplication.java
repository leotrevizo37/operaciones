package com.duma.shell;

import com.duma.shell.config.DumaProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
@EnableConfigurationProperties(DumaProperties.class)
public class AppShellApplication {

  public static void main(String[] args) {
    SpringApplication.run(AppShellApplication.class, args);
  }
}
