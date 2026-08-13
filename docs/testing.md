# Estrategia de pruebas

Cada aplicacion contiene tres capas independientes:

1. Unitarias: reglas de cobertura, validacion, calculos de veredicto, componentes y estados vacios.
2. Integracion: API, SQL parametrizado y transacciones contra SQL Server real mediante Testcontainers.
3. E2E: arranque standalone, estados de carga/error/vacio/datos, filtros, badge de procedencia y handshake con el shell.

Las pruebas de cobertura multi-tenant deben demostrar que:

- un tenant disponible no queda oculto por otro sin tabla;
- `NO_DATA` no se convierte en cero;
- `NOT_SUPPORTED` no se convierte en error global;
- `UNAVAILABLE` conserva una causa sanitizada;
- el orden de tenants es determinista;
- la analitica de SmartAudits conserva cobertura independiente para los siete tenants;
- la cola de revision humana de SmartAudits no consulta ni modifica tenants distintos de `carlsjr`.

SmartAudits agrega pruebas transaccionales de llave compuesta, categoria invalida, idempotencia, rollback y consistencia cola-lookup.

## Reproduccion

La matriz completa se ejecuta desde la raiz:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\validate.ps1 -Install -PortsFile .\config\ports.example.ps1
```

Cada frontend conserva en `package.json` los comandos `lint`, `test`, `build` y `e2e`. Cada backend conserva unitarias Surefire e integraciones Failsafe dentro del reactor Maven raiz. Las integraciones levantan SQL Server mediante Testcontainers y requieren Docker Desktop.

La ausencia de Docker hace fallar Failsafe; no convierte las integraciones en omitidas. Al terminar Maven, el runner inspecciona los XML de los cinco backends y exige al menos una integracion ejecutada y cero `skipped` en cada uno.

Los E2E levantan Vite con `strictPort` y el puerto canonico de cada frontend. Los cinco `PortConfigurationTest` cargan el `application.yml` real y comprueban que puertos alternativos se propaguen a servidor, API, issuer, JWKS, CORS y URLs remotas.

Los resultados de cada ejecucion se conservan en `docs/auditoria-temporal`; una prueba solo se considera aprobada cuando su evidencia indica `PASS` y no registra omisiones.
