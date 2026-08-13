package com.duma.experience.domain;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class CoverageResolverTest {
  @ParameterizedTest
  @CsvSource({
    "false,false,0,NOT_SUPPORTED",
    "true,false,0,NO_DATA",
    "false,true,0,NO_DATA",
    "true,true,0,NO_DATA",
    "true,false,1,AVAILABLE",
    "false,true,1,AVAILABLE"
  })
  void distinguishesMissingSourcesFromEmptyAndAvailableData(
      boolean users, boolean availability, long rows, CoverageStatus expected) {
    assertThat(CoverageResolver.resolve(users, availability, rows)).isEqualTo(expected);
  }
}
