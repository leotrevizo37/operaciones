# Mapa de configuracion local

## Aplicaciones y puertos por defecto

| Aplicacion | Directorio | Puerto interno/backend | Puerto Vite | Variable de puerto host Compose |
|---|---|---:|---:|---|
| Resumen ICOS y shell | `app-shell` | 8080 | 5173 | `DUMA_SHELL_HOST_PORT` |
| Experiencia Digital | `experiencia-digital` | 8081 | 5174 | `DUMA_EXPERIENCE_HOST_PORT` |
| Lecturas | `lecturas` | 8082 | 5175 | `DUMA_READINGS_HOST_PORT` |
| Dispositivos | `dispositivos` | 8083 | 5176 | `DUMA_DEVICES_HOST_PORT` |
| SmartAudits | `smartaudits` | 8084 | 5177 | `DUMA_SMARTAUDITS_HOST_PORT` |

Los puertos host pueden cambiar. Los puertos internos quedan fijados por cada `compose.yaml`.

## Plantillas permitidas

Leer solamente:

- `app-shell/.env.example`
- `experiencia-digital/.env.example`
- `lecturas/.env.example`
- `dispositivos/.env.example`
- `smartaudits/.env.example`
- `config/ports.example.ps1`
- `config/runtime.example.ps1`
- `<aplicacion>/backend/application.example.yml`

No abrir el archivo resultante `.env` ni copiar su contenido a otro lugar.

## Responsabilidad de las variables

### Shell

- Imagen y puerto host.
- Conexion a `DumaSystemLogs`.
- Issuer, duracion de tokens, llaves RSA y sesion.
- URL publica de `remote-entry.js` y `apiBaseUrl` de los cuatro modulos remotos.
- Etapa de liberacion, entorno de datos, frescura, clearance y alcance.

### Modulos remotos

- Imagen y puerto host.
- Conexion a `DumaSystemLogs`.
- Issuer esperado y URL JWKS del shell.
- URL publica propia, modo standalone y origenes CORS.
- Habilitacion y conexion SQL Server por tenant.

No inventar bases para tenants desconocidos. Mantenerlos deshabilitados hasta conocer el nombre real.

## Reglas de topologia local con Docker

Usar tres perspectivas distintas:

1. El navegador llega a cada servicio mediante `http://localhost:<puerto-host>`.
2. Un contenedor llega a un servicio del host mediante `host.docker.internal:<puerto-host>`.
3. Cada aplicacion escucha dentro del contenedor en su puerto interno fijo.

Aplicar estas reglas:

- `DUMA_AUTH_ISSUER` debe coincidir exactamente en el shell y en los cuatro modulos. Normalmente es la URL publica del shell vista por el navegador.
- `DUMA_AUTH_JWKS_URI` debe ser alcanzable desde el contenedor remoto. Si apunta al shell publicado en el host, usar `host.docker.internal`, no `localhost`.
- Las URLs `REMOTE_ENTRY_URL` y `API_BASE_URL` registradas en el shell son consumidas por el navegador; usar `localhost` y el puerto host correspondiente.
- `ALLOWED_ORIGINS` debe incluir el origen exacto del shell, con esquema y puerto y sin rutas.
- Si SQL Server corre en el host, los contenedores normalmente usan `host.docker.internal`; si corre en otra maquina, usar el hostname privado aprobado.

Ejemplo unicamente de topologia, sin secretos, con shell `8085`, dispositivos `8086`, experiencia `8087`, lecturas `8088` y SmartAudits `8089`:

```text
Shell publico:              http://localhost:8085
Experience remote entry:   http://localhost:8087/remote-entry.js
Experience API:            http://localhost:8087
Readings remote entry:     http://localhost:8088/remote-entry.js
Readings API:              http://localhost:8088
Devices remote entry:      http://localhost:8086/remote-entry.js
Devices API:               http://localhost:8086
SmartAudits remote entry:  http://localhost:8089/remote-entry.js
SmartAudits API:           http://localhost:8089
JWKS desde contenedores:   http://host.docker.internal:8085/api/integration/jwks
Origen CORS del shell:     http://localhost:8085
```

## Llaves y credenciales

Para un entorno local efimero, `DUMA_ALLOW_EPHEMERAL_KEYS=true` permite al shell generar llaves temporales. No usarlo como sustituto de llaves persistentes en un entorno compartido o productivo.

Para llaves persistentes, la persona debe suministrar privada y publica mediante el mecanismo secreto autorizado y mantener `DUMA_ALLOW_EPHEMERAL_KEYS=false`.

Los passwords de SQL Server y del usuario humano nunca deben aparecer en comandos, archivos versionados, mensajes ni logs. Preferir prompts seguros cuando se usen los scripts PowerShell.

## Diferencia entre Compose y Development

| Ruta | Frontend | Seguridad de API remota | Entrada esperada |
|---|---|---|---|
| `make up` o Compose | Compilado dentro de cada JAR | JWT requerido | Shell |
| `start-environment.ps1 -Mode Development` | Vite independiente | Perfil `dev` permite lectura standalone | Shell o `517x` |
| `start-environment.ps1 -Mode Artifacts` | Compilado dentro de cada JAR | JWT requerido | Shell |

Un `HTTP 200` en `/` solo demuestra que cargo el HTML. Un `401` en la API del modulo abierto directamente es esperado cuando standalone esta deshabilitado.
