package com.duma.devices.domain;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class EquipmentTypeClassifierTest {
  @ParameterizedTest
  @CsvSource({
    "Cuarto frío principal,CUARTO_FRIO",
    "Refrigerador walk-in,CUARTO_FRIO",
    "Aire acondicionado,HVAC",
    "Báscula de recibo,BASCULA",
    "Alarma de seguridad,SEGURIDAD",
    "Equipo experimental,NO_CLASIFICADO"
  })
  void classifiesKnownFamiliesWithoutGuessingUnknownEquipment(
      String rawType, EquipmentKind expected) {
    assertThat(EquipmentTypeClassifier.classify(rawType)).isEqualTo(expected);
  }
}
