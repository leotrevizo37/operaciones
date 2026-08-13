package com.duma.devices;

import com.duma.devices.config.ModuleProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
@EnableConfigurationProperties(ModuleProperties.class)
public class DevicesApplication {
  public static void main(String[] args) {
    SpringApplication.run(DevicesApplication.class, args);
  }
}
