package com.duma.smartaudits;

import com.duma.smartaudits.config.ModuleProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
@EnableConfigurationProperties(ModuleProperties.class)
public class SmartAuditsApplication {
  public static void main(String[] args) {
    SpringApplication.run(SmartAuditsApplication.class, args);
  }
}
