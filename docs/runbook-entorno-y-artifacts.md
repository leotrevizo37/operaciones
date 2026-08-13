# Runbook detallado: configuracion, arranque y artifacts

## 1. Que ejecuta cada modo

Hay tres operaciones distintas:

| Operacion | Comando principal | Resultado |
|---|---|---|
| Construir y probar | `scripts\build-artifacts.ps1` | Cinco JARs ejecutables con su frontend embebido y un manifiesto SHA-256 |
| Desarrollo integrado | `scripts\start-environment.ps1 -Mode Development` | Cinco backends Java 17 en Docker y cinco servidores Vite |
| Ejecutar artifacts | `scripts\start-environment.ps1 -Mode Artifacts` | Cinco JARs en Java 17; cada backend sirve su frontend compilado |

En modo `Artifacts` no se usan los puertos `5173` a `5177`. El punto de entrada integrado es el shell en su puerto backend. Los otros cuatro backends siguen siendo ejecutables y consultables por separado.

## 2. Donde va cada configuracion

La configuracion local esta separada en dos archivos ignorados por Git:

| Archivo | Contenido permitido | Contenido prohibido |
|---|---|---|
| `config\ports.local.ps1` | Los diez puertos | Passwords, tokens o llaves |
| `config\runtime.local.ps1` | Hosts, nombres de bases, usuarios, badges y ajustes no secretos | Passwords, llave RSA privada o tokens |

Las plantillas versionadas son `config\ports.example.ps1` y `config\runtime.example.ps1`. En este checkout ya existen ambos archivos `.local.ps1` con los defaults locales; están ignorados y no forman parte del diff versionable.

Los secretos no van en un archivo del repo. Los scripts los solicitan mediante un prompt seguro y los conservan solamente en memoria durante el arranque:

- password de SQL Server para `DumaSystemLogs`;
- password de SQL Server para los warehouses;
- password de cada usuario humano del shell;
- llave RSA privada del shell en un despliegue persistente.

No se debe crear un `.env`. Tampoco se debe escribir el password en el comando, en `runtime.local.ps1`, en `application.yml` ni en un log.

## 3. Configuracion local actual

Desde una terminal PowerShell:

```powershell
Set-Location 'C:\Users\Leonardo Trevizo\IdeaProjects\operaciones-duma'
Set-ExecutionPolicy -Scope Process Bypass
notepad .\config\ports.local.ps1
notepad .\config\runtime.local.ps1
```

`Set-ExecutionPolicy -Scope Process Bypass` afecta únicamente esa terminal y no cambia la política del equipo.

### 3.1 Puertos

| Aplicacion | Backend | Frontend de desarrollo |
|---|---:|---:|
| Shell | 8080 | 5173 |
| Experiencia y disponibilidad | 8081 | 5174 |
| Lecturas | 8082 | 5175 |
| Dispositivos | 8083 | 5176 |
| SmartAudits | 8084 | 5177 |

Para cambiar un puerto, editar únicamente su valor en `config\ports.local.ps1`. El script valida rango, duplicados y puertos ocupados antes de iniciar; Vite usa `strictPort`, por lo que ningún proceso cambia silenciosamente a otro puerto.

### 3.2 SQL Server y bases por tenant

`config\runtime.local.ps1` contiene host, puerto, usuario y nombres de bases, pero nunca el password. Los valores locales de host y puerto ya apuntan al SQL Server del equipo.

Las variables de tenant son:

| Tenant | Variable de base |
|---|---|
| Carls Jr | `DUMA_TENANT_CARLSJR_DATABASE` |
| Emerson | `DUMA_TENANT_EMERSON_DATABASE` |
| Valle del Encino | `DUMA_TENANT_VALLEDELENCINO_DATABASE` |
| McDonalds | `DUMA_TENANT_MCDONALDS_DATABASE` |
| McDonalds CDP | `DUMA_TENANT_MCDONALDS_CDP_DATABASE` |
| SmartFit | `DUMA_TENANT_SMARTFIT_DATABASE` |
| Bafar POC gabinete | `DUMA_TENANT_BAFAR_POC_GABINETE_DATABASE` |

Los tres nombres conocidos ya están definidos. Los otros cuatro permanecen vacíos hasta conocer su nombre real. Una variable vacía no detiene el sistema: ese tenant se informa como `UNAVAILABLE` en el módulo correspondiente. No se debe inventar un nombre para evitar ese estado.

## 4. Prerrequisitos locales

Comprobar una sola vez:

```powershell
docker version
node --version
npm.cmd --version
sqlcmd -?
```

El host no necesita Maven ni Java 17 instalados. Los scripts usan:

- `maven:3.9.14-eclipse-temurin-17` para compilar y probar;
- `eclipse-temurin:17-jre` para ejecutar cada JAR;
- Docker Desktop para Testcontainers y los backends locales;
- Node/npm del host para Vite.

## 5. Inicializar DumaSystemLogs

Ejecutar una vez por base nueva, o nuevamente cuando se agregue un script idempotente:

```powershell
.\scripts\initialize-databases.ps1
```

El prompt pide la credencial SQL configurada por `DUMA_SYSTEMLOG_MSSQL_USERNAME`. El password se escribe en la ventana segura; no aparece en el historial.

El script:

1. conecta al host y puerto de `config\runtime.local.ps1`;
2. crea `DumaSystemLogs` si todavía no existe;
3. aplica los diez scripts versionados de `db\init`;
4. deja evidencia sin secretos en `.runtime\logs\<fecha>-database-init.log`;
5. elimina la variable temporal `SQLCMDPASSWORD` al terminar.

Requiere que esa identidad tenga permiso para crear la base en la primera corrida y para crear o alterar esquemas, tablas y procedimientos. En corridas posteriores los scripts son idempotentes.

## 6. Crear el usuario para entrar al shell

Después de inicializar la base y construir el JAR del shell:

```powershell
.\scripts\provision-shell-user.ps1 -Username investigador -DisplayName 'Investigador'
```

Se solicitan dos credenciales diferentes:

1. el password nuevo del usuario humano del shell;
2. la credencial SQL que autoriza guardar el usuario.

El primer password se transforma a BCrypt dentro de Java 17 y sólo el hash llega a `security.usp_UpsertAppUser`. Ni el password ni su hash se escriben en archivos. Los roles, permisos y alcance quedan preparados en la fila, pero esta revisión todavía no aplica autorización granular.

Para indicar valores explícitos:

```powershell
.\scripts\provision-shell-user.ps1 `
  -Username investigador `
  -DisplayName 'Investigador' `
  -Roles RESEARCHER `
  -TenantScope carlsjr,emerson,valledelencino,mcdonalds,mcdonalds-cdp,smartfit,bafar-poc-gabinete
```

## 7. Construir artifacts reproducibles

Primera compilación o después de modificar dependencias frontend:

```powershell
.\scripts\build-artifacts.ps1 -Install
```

Compilaciones posteriores con `node_modules` vigente:

```powershell
.\scripts\build-artifacts.ps1
```

El script ejecuta el build de los cinco frontends, `mvn verify` de los cinco backends con Java 17 y luego genera:

```text
artifacts/
  manifest.json
  app-shell/app-shell.jar
  experiencia-digital/experiencia-digital.jar
  lecturas/lecturas.jar
  dispositivos/dispositivos.jar
  smartaudits/smartaudits.jar
```

Cada JAR contiene el frontend compilado. `manifest.json` registra nombre, tamaño y SHA-256. `artifacts\` está ignorado por Git y no se publica automáticamente.

## 8. Levantar todo para desarrollo

```powershell
.\scripts\start-environment.ps1 -Mode Development
```

Con la configuración local actual se solicita una sola credencial SQL porque system logs y warehouses usan el mismo host y usuario. El script inicializa la base, levanta cinco contenedores Java 17, levanta cinco procesos Vite y espera sus health checks.

URLs por defecto:

- shell: `http://localhost:5173`;
- experiencia: `http://localhost:5174`;
- lecturas: `http://localhost:5175`;
- dispositivos: `http://localhost:5176`;
- SmartAudits: `http://localhost:5177`.

Los módulos usan perfil `dev` para permitir lectura standalone. La aprobación SmartAudits sigue exigiendo el JWT del shell.

## 9. Levantar los artifacts integrados

Después de ejecutar las secciones 5, 6 y 7:

```powershell
.\scripts\start-environment.ps1 -Mode Artifacts -SkipDatabaseInitialization
```

Este modo inicia únicamente cinco contenedores Java 17. No activa el perfil `dev`: el shell autentica y los cuatro módulos validan el handshake/JWT normal.

URLs por defecto:

- shell y resumen integrado: `http://localhost:8080`;
- experiencia standalone: `http://localhost:8081`;
- lecturas standalone: `http://localhost:8082`;
- dispositivos standalone: `http://localhost:8083`;
- SmartAudits standalone: `http://localhost:8084`.

Para una primera corrida se puede omitir `-SkipDatabaseInitialization`; el script inicializa la base antes de arrancar.

## 10. Estado, logs y apagado

Estado de los procesos administrados:

```powershell
.\scripts\status-environment.ps1
```

Estado con las últimas líneas de logs:

```powershell
.\scripts\status-environment.ps1 -IncludeLogs
```

Los logs locales están en `.runtime\logs`. El estado con PIDs, nombres de contenedor y URLs está en `.runtime\environment.json`. Ninguno debe contener secretos.

Apagado ordenado:

```powershell
.\scripts\stop-environment.ps1
```

El script sólo detiene los PIDs y contenedores registrados por este proyecto.

## 11. Ejecutar un artifact por separado

Cada JAR es independiente. Para una ejecución individual se deben inyectar las mismas variables documentadas en `config\runtime.example.ps1` y en el `backend\application.example.yml` del módulo. El password debe entrar desde el gestor de secretos o desde una variable de proceso preparada de forma segura, y Docker debe recibir únicamente el nombre de la variable con `-e`, nunca su valor en el argumento.

Ejemplo conceptual para Lecturas:

```powershell
. .\config\ports.local.ps1
. .\config\runtime.local.ps1
$credential = Get-Credential -UserName $env:DUMA_WAREHOUSE_MSSQL_USERNAME
$env:DUMA_WAREHOUSE_MSSQL_PASSWORD = $credential.GetNetworkCredential().Password
$env:DUMA_SYSTEMLOG_MSSQL_PASSWORD = $credential.GetNetworkCredential().Password
$env:DUMA_WAREHOUSE_MSSQL_HOST = 'host.docker.internal'
$env:DUMA_SYSTEMLOG_MSSQL_HOST = 'host.docker.internal'

docker run --rm --name duma-lecturas-standalone `
  --add-host host.docker.internal:host-gateway `
  -p ${env:DUMA_READINGS_BACKEND_PORT}:${env:DUMA_READINGS_BACKEND_PORT} `
  -e DUMA_READINGS_BACKEND_PORT `
  -e DUMA_SYSTEMLOG_MSSQL_HOST `
  -e DUMA_SYSTEMLOG_MSSQL_PORT `
  -e DUMA_SYSTEMLOG_MSSQL_DATABASE `
  -e DUMA_SYSTEMLOG_MSSQL_USERNAME `
  -e DUMA_SYSTEMLOG_MSSQL_PASSWORD `
  -e DUMA_WAREHOUSE_MSSQL_HOST `
  -e DUMA_WAREHOUSE_MSSQL_PORT `
  -e DUMA_WAREHOUSE_MSSQL_USERNAME `
  -e DUMA_WAREHOUSE_MSSQL_PASSWORD `
  -e DUMA_TENANT_CARLSJR_DATABASE `
  -v "${PWD}\artifacts\lecturas\lecturas.jar:/app/application.jar:ro" `
  eclipse-temurin:17-jre java -jar /app/application.jar --spring.profiles.active=dev

Remove-Item Env:DUMA_WAREHOUSE_MSSQL_PASSWORD,Env:DUMA_SYSTEMLOG_MSSQL_PASSWORD
```

El perfil `dev` es únicamente para lectura standalone local. En integración y despliegue se omite.

## 12. Desplegar artifacts en otro host

Este repositorio no publica ni transfiere artifacts. El despliegue privado sigue este contrato:

1. ejecutar `scripts\build-artifacts.ps1` en CI o en una estación autorizada;
2. comprobar los SHA-256 de `artifacts\manifest.json`;
3. transferir privadamente los cinco JARs al host autorizado;
4. definir puertos, hosts, nombres de bases, URLs, badges y clearance como configuración no secreta del orquestador;
5. inyectar passwords y `DUMA_JWT_PRIVATE_KEY_BASE64` desde el gestor de secretos del entorno;
6. usar Java 17 para cada JAR;
7. publicar únicamente el shell detrás de HTTPS/reverse proxy;
8. conservar los módulos en red interna si no necesitan exposición directa;
9. comprobar `/actuator/health` antes de enviar tráfico;
10. detener o revertir el release si un health check no queda `UP`.

Fuera de desarrollo son obligatorios:

```text
DUMA_ALLOW_EPHEMERAL_KEYS=false
DUMA_SESSION_SECURE_COOKIE=true
DUMA_JWT_PRIVATE_KEY_BASE64=<desde gestor de secretos>
DUMA_JWT_PUBLIC_KEY_BASE64=<configuracion publica correspondiente>
```

No se debe usar `--spring.profiles.active=dev` en stage o producción. Los badges de cada módulo deben reflejar por separado `RELEASE_STAGE`, `DATA_ENVIRONMENT`, `FRESHNESS_MODE`, `TENANT_SCOPE` y `CLEARANCE`; el badge describe procedencia y alcance, pero no sustituye controles de red ni autorización.

## 13. Diagnostico directo

### Puerto ocupado

El arranque muestra el puerto y PID. Cambiar el valor en `config\ports.local.ps1`, no agregar `--port` manualmente.

### Falta un JAR

Ejecutar `scripts\build-artifacts.ps1`. El arranque no compila de forma implícita.

### Un tenant aparece `UNAVAILABLE`

Revisar únicamente su variable `DUMA_TENANT_*_DATABASE`. Vacío significa no liberado; un nombre incorrecto o base inaccesible también se aísla a ese tenant.

### `NOT_SUPPORTED`

La base fue accesible, pero el esquema esperado por ese módulo no existe para ese tenant. No equivale a cero ni a falta de filas.

### `NO_DATA`

El esquema existe y la consulta fue válida, pero el periodo no devolvió registros.

### El shell abre pero no permite login

Ejecutar la inicialización de base y luego `provision-shell-user.ps1`. El password de SQL y el password del usuario del shell no son la misma credencial lógica.

### Un módulo no carga desde el shell

Comprobar primero `status-environment.ps1`; después consultar su URL y `remote-entry.js`. El fallo queda aislado al módulo y no debe derribar el resumen completo.
