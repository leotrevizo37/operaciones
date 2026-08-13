# Estado, origen y alcance del dato

Cada modulo muestra un grupo de badges persistente. Las dimensiones no se combinan para evitar que "modulo en pruebas" se interprete como "datos de prueba" o que "datos de produccion" se interprete como "modulo liberado".

## Etapa de liberacion

- `DEVELOPMENT`
- `TESTING`
- `STAGING`
- `PRODUCTION`

## Entorno del dato

- `DEVELOPMENT`
- `TEST`
- `STAGE`
- `PRODUCTION`

## Frescura

- `LIVE`
- `SNAPSHOT`
- `MOCK`

`LIVE` exige un timestamp de ultima actualizacion. `SNAPSHOT` exige fecha de corte. `MOCK` nunca puede usar el tratamiento visual de produccion.

## Clearance y alcance

La clasificacion inicial es `ACADEMIC_PRIVATE`. El alcance declara `ALL_TENANTS`, `SELECTED_TENANTS` o `CARLSJR_ONLY`.

Los badges son informacion y no una frontera de seguridad. La autorizacion futura debera validarse en backend aun cuando el frontend oculte una accion.
