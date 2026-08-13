# Arquitectura

## Limites de dominio

La solucion contiene un shell y cuatro verticales independientes. Cada vertical posee su UI, API, acceso de solo lectura a los warehouses, auditoria SQL Server y suite de pruebas. No existe una libreria de runtime compartida entre modulos; el acoplamiento se limita a contratos HTTP y DOM versionados para que cada directorio pueda convertirse en repositorio independiente.

```text
Navegador
  |
  | cookie de sesion HttpOnly
  v
App Shell
  |-- Resumen ICOS
  |-- Registro de modulos
  |-- Emision de JWT por audiencia
  |
  +-- duma-experience-module  --> Experience API
  +-- duma-readings-module    --> Readings API
  +-- duma-devices-module     --> Devices API
  +-- duma-smartaudits-module --> SmartAudits API

Cada backend --> SQL Server de system logs
Cada modulo  --> Warehouses SQL Server por tenant
```

## Frontera de integracion

Los frontends remotos publican un archivo ESM `remote-entry.js` que registra un Custom Element. El shell carga el archivo desde el registro de modulos, espera `customElements.whenDefined`, asigna el contexto con `setHostContext` y exige el evento `duma:module-ready` con la version `1.0`, el mismo `moduleId` y todas las capacidades declaradas.

No se comparte estado React, CSS global ni dependencias JavaScript entre aplicaciones. Cada modulo usa Shadow DOM para encapsular presentacion e incluye una aplicacion standalone servida por su propio backend.

## Autenticacion y preparacion de permisos

El shell autentica contra su tabla SQL Server y conserva la sesion en una cookie `HttpOnly`, `SameSite=Lax` y `Secure` configurable. Un modulo solicita al host un token en memoria. El shell emite un JWT RS256 corto con:

- `iss`, `sub`, `aud`, `iat`, `exp` y `jti`.
- `session_id` y `display_name`.
- `tenant_scope`.
- `roles` y `permissions`, inicialmente informativos y sin reglas de autorizacion.

Cada backend valida firma, expiracion, emisor y audiencia. El navegador no persiste el token. Los modulos no implementan login. En modo standalone, sus endpoints de lectura pueden habilitarse para desarrollo local; las mutaciones SmartAudits permanecen bloqueadas sin una identidad emitida por el shell.

## Datos multi-tenant

El registro contiene siete tenants. Las consultas se ejecutan de forma aislada por tenant. El fallo de uno no invalida la respuesta de los demas. Antes de consultar, cada repositorio comprueba la existencia de los objetos requeridos.

| Estado | Significado | Tratamiento visual |
|---|---|---|
| `AVAILABLE` | Objetos presentes y filas en el periodo | KPIs y evidencia |
| `NO_DATA` | Objetos presentes sin filas | Estado vacio neutral |
| `NOT_SUPPORTED` | Objetos requeridos ausentes | Sin cobertura, neutral |
| `UNAVAILABLE` | Conexion o consulta fallida | Servicio no disponible, advertencia |

`NO_DATA` y `NOT_SUPPORTED` no son estados operativos buenos o malos. El shell los representa en gris y conserva la causa tecnica sanitizada.

## System logs

Cada backend escribe eventos con su propio `application_id` en SQL Server. La configuracion separa el host de auditoria de los warehouses. Se registran request id, correlation id, actor, tenant, resultado, duracion, origen, user agent sanitizado y metadata JSON limitada. No se almacenan contrasenas, tokens, comentarios SmartAudits, cuerpos de respuesta ni datos de sensores.

Los eventos de request son asincronos. Las acciones auditables, como una promocion SmartAudits, se escriben de forma sincrona despues de confirmar la transaccion de negocio.

## Lectura operativa de UI

El shell sirve soporte de decision para directivo o gerente regional: densidad 2, proximidad de accion 1 y orientacion temporal 3. Abre con un veredicto BLUF y organiza el resumen por ICOS.

Experiencia, Lecturas y Dispositivos sirven exploracion y triage para gerente de sitio u operador: densidad 6, accion 2 a 4 y orientacion temporal 5 a 7. SmartAudits combina exploracion con una superficie de accion humana: densidad 8 y accion 8 dentro de la cola.

Todas las vistas usan modo claro, maximo tres severidades, timestamp real, filtros visibles, estados vacios y detalle inline o modal centrado. No usan gauges, graficas 3D, drawers laterales ni numeros sin baseline.
