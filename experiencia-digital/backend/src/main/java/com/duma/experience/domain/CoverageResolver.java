package com.duma.experience.domain;

public final class CoverageResolver {

  private CoverageResolver() {}

  public static CoverageStatus resolve(
      boolean userSourcePresent, boolean availabilitySourcePresent, long observedRows) {
    if (!userSourcePresent && !availabilitySourcePresent) {
      return CoverageStatus.NOT_SUPPORTED;
    }
    return observedRows == 0 ? CoverageStatus.NO_DATA : CoverageStatus.AVAILABLE;
  }
}
