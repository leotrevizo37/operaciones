# Operaciones Duma

Monorepo privado de microfrontends operativos para la investigacion academica Duma. Cada aplicacion conserva su propio backend, frontend, inicializacion de auditoria y pruebas para poder ejecutarse y migrarse de forma independiente.

## Aplicaciones

| Directorio | Dominio | Backend | Frontend | Elemento web |
|---|---|---:|---:|---|
| `app-shell` | Resumen ICOS, autenticacion e integracion | 8080 | 5173 | Aplicacion host |
| `experiencia-digital` | Experiencia de usuarios y disponibilidad | 8081 | 5174 | `duma-experience-module` |
| `lecturas` | Continuidad y excepciones de lecturas | 8082 | 5175 | `duma-readings-module` |
| `dispositivos` | Salud y diagnostico de equipos | 8083 | 5176 | `duma-devices-module` |
| `smartaudits` | SmartAudits y cola de revision humana | 8084 | 5177 | `duma-smartaudits-module` |

## Principios del corte

- El shell es el unico punto de autenticacion real y mantiene el resumen ejecutivo.
- Los modulos se integran mediante Custom Elements y un contrato versionado.
- El shell entrega tokens OAuth 2.0 JWT de vida corta y audiencia exclusiva por modulo.
- Los permisos viajan en el contrato y el token, pero no se aplican en esta revision.
- Cada tenant informa `AVAILABLE`, `NO_DATA`, `NOT_SUPPORTED` o `UNAVAILABLE`; la ausencia de una tabla o de filas nunca se representa como cero.
- Cada modulo muestra por separado su etapa de liberacion, entorno y frescura del dato, alcance y clasificacion academica.
- Los system logs se escriben en SQL Server mediante host, puerto y base configurables.
- Los diez puertos se fijan mediante `config/ports.example.ps1`; Vite usa `strictPort` y nunca cambia de puerto silenciosamente.

## Tenants

`carlsjr`, `emerson`, `valledelencino`, `mcdonalds`, `mcdonalds-cdp`, `smartfit` y `bafar-poc-gabinete`.

La analitica de SmartAudits consulta los siete tenants y devuelve cobertura explicita por cada uno. Unicamente la promocion de la cola de revision humana permanece limitada a `carlsjr`.

## Documentacion

- `docs/architecture.md`
- `docs/integration-contract.md`
- `docs/data-status.md`
- `docs/testing.md`
- `docs/operacion-y-arranque.md`
- `docs/runbook-entorno-y-artifacts.md`
- `docs/auditoria-temporal/README.md`

No se incluyen credenciales ni valores de secretos. Cada backend documenta solamente nombres de variables y ejemplos no sensibles.
