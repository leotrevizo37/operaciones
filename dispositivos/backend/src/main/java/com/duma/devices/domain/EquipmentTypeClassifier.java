package com.duma.devices.domain;

import java.text.Normalizer;
import java.util.Locale;

public final class EquipmentTypeClassifier {
  private EquipmentTypeClassifier() {}

  public static EquipmentKind classify(String value) {
    if (value == null || value.isBlank()) return EquipmentKind.NO_CLASIFICADO;
    String type =
        Normalizer.normalize(value, Normalizer.Form.NFD)
            .replaceAll("\\p{M}", "")
            .toLowerCase(Locale.ROOT);
    if (type.contains("cuarto frio") || type.contains("cold room") || type.contains("refriger"))
      return EquipmentKind.CUARTO_FRIO;
    if (type.contains("hvac") || type.contains("clima") || type.contains("aire acondicionado"))
      return EquipmentKind.HVAC;
    if (type.contains("bascula") || type.contains("scale")) return EquipmentKind.BASCULA;
    if (type.contains("seguridad") || type.contains("security") || type.contains("alarma"))
      return EquipmentKind.SEGURIDAD;
    return EquipmentKind.NO_CLASIFICADO;
  }
}
