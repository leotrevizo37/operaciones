package com.duma.experience;

import com.duma.experience.config.ModuleProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
@EnableConfigurationProperties(ModuleProperties.class)
public class ExperienceApplication {

  public static void main(String[] args) {
    SpringApplication.run(ExperienceApplication.class, args);
  }
}
