package com.duma.readings;

import com.duma.readings.config.ModuleProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
@EnableConfigurationProperties(ModuleProperties.class)
public class ReadingsApplication {
  public static void main(String[] args) {
    SpringApplication.run(ReadingsApplication.class, args);
  }
}
