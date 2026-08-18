---
name: arrancar-operaciones-duma
description: "Preparar y arrancar localmente el monorepo privado Operaciones Duma desde una copia nueva o detenida: comprobar prerrequisitos, guiar al colaborador en la creacion manual de los cinco .env a partir de .env.example, validar la topologia de URLs sin leer secretos, ejecutar make up o su equivalente directo con Docker Compose cuando GNU Make no exista, comprobar salud y diagnosticar fallos de arranque o HTTP 401 standalone. Usar ante solicitudes de onboarding, instalacion local, configuracion inicial, levantar o bajar el stack, falta de make o acceso directo a los microfrontends. No usar para desplegar, publicar ni alterar infraestructura productiva."
---

# Arrancar Operaciones Duma

## Objetivo

Dejar el stack local reproducible y verificable desde la raiz del repositorio. Mantener separados:

- el arranque integrado con Docker Compose, que sirve frontend y backend por los puertos backend;
- el desarrollo con Vite y perfil Spring `dev`, que permite lectura standalone;
- la construccion de artifacts, que no equivale a desplegarlos.

El `Makefile` raiz levanta cinco aplicaciones: `app-shell`, `experiencia-digital`, `lecturas`, `dispositivos` y `smartaudits`.

## Limites obligatorios

- Trabajar solo en el checkout privado y local.
- No leer, mostrar, buscar, editar ni inferir el contenido de ningun `.env`, credencial, token, llave o password.
- Leer solamente `.env.example`, `application.example.yml` y archivos versionados no sensibles.
- Guiar a la persona para que cree y complete los `.env` manualmente; nunca capturar sus valores en el chat, comandos, logs o archivos generados por la IA.
- No ejecutar `docker compose config` sin `--quiet`, porque puede imprimir valores expandidos.
- No instalar software sin autorizacion explicita.
- No hacer commit, push, despliegue, publicacion ni transferencia de artifacts.
- No cambiar puertos, seguridad, codigo o configuracion versionada para conseguir que el arranque pase.

## Flujo principal: Docker Compose

### 1. Confirmar la raiz y los archivos fuente

Trabajar desde la carpeta que contiene:

```text
Makefile
app-shell/compose.yaml
experiencia-digital/compose.yaml
lecturas/compose.yaml
dispositivos/compose.yaml
smartaudits/compose.yaml
```

No buscar archivos secretos. Comprobar unicamente los archivos versionados anteriores y sus `.env.example`.

### 2. Comprobar prerrequisitos

Ejecutar comprobaciones no mutantes:

```powershell
docker version
docker compose version
Get-Command make -ErrorAction SilentlyContinue
Get-Command choco,scoop,winget -ErrorAction SilentlyContinue
```

Exigir Docker operativo y Docker Compose v2. GNU Make es opcional.

Si Docker no responde, detenerse y pedir que la persona inicie o instale Docker Desktop. No modificar el servicio, WSL o la configuracion de Docker sin autorizacion.

Si falta `make`, preferir la ruta directa de Docker Compose descrita abajo. Si la persona pide instalarlo:

1. Detectar sistema operativo y gestor disponible.
2. Mostrar el paquete de GNU Make que se instalaria.
3. Solicitar autorizacion.
4. Instalar con el gestor aprobado y comprobar `make --version`.

En Windows, si Chocolatey ya existe, el comando habitual es `choco install make`; ejecutarlo solo despues de la autorizacion. Con Winget o Scoop, buscar primero el paquete vigente y no elegir uno ambiguo automaticamente.

### 3. Preparar la configuracion privada

Leer [references/configuracion-local.md](references/configuracion-local.md) antes de orientar el llenado.

Antes de crear archivos, pedir a la persona que confirme que `.env` esta excluido localmente de Git. Puede comprobarlo sin mostrar contenido con:

```powershell
git check-ignore -q --no-index app-shell/.env
```

Si no esta ignorado, pedirle agregar `**/.env` a `.git/info/exclude` o al mecanismo privado aprobado. No crear los archivos hasta recibir confirmacion.

Entregar a la persona este bloque como instruccion manual. No ejecutarlo desde la IA:

```powershell
Copy-Item .\app-shell\.env.example .\app-shell\.env
Copy-Item .\experiencia-digital\.env.example .\experiencia-digital\.env
Copy-Item .\lecturas\.env.example .\lecturas\.env
Copy-Item .\dispositivos\.env.example .\dispositivos\.env
Copy-Item .\smartaudits\.env.example .\smartaudits\.env
```

Pedir que la persona:

1. Reemplace manualmente todos los placeholders.
2. Mantenga coherentes puertos, issuer, JWKS, URLs publicas y origen permitido.
3. Configure solamente tenants cuyos nombres de base sean conocidos.
4. Confirme por texto que termino, sin pegar valores.

No continuar si la persona informa placeholders pendientes, puertos duplicados o secretos expuestos.

### 4. Preparar la base en una instalacion nueva

Si `DumaSystemLogs` y el usuario del shell ya existen, no repetir esta etapa.

Para una base nueva, entregar este flujo seguro:

```powershell
Copy-Item .\config\ports.example.ps1 .\config\ports.local.ps1
Copy-Item .\config\runtime.example.ps1 .\config\runtime.local.ps1
.\scripts\initialize-databases.ps1
.\scripts\provision-shell-user.ps1 -Username <usuario> -DisplayName '<nombre>'
```

La persona debe completar los dos archivos `.local.ps1` sin secretos y responder directamente a los prompts seguros. No aceptar passwords como argumentos, mensajes o variables impresas. No ejecutar el aprovisionamiento si la identidad SQL no tiene los permisos informados por el runbook.

### 5. Levantar el stack

Si `make` existe, ejecutar desde la raiz:

```powershell
make up
```

Si `make` no existe, ejecutar el equivalente exacto, en este orden:

```powershell
docker compose -f .\app-shell\compose.yaml up -d --build --wait --wait-timeout 120
docker compose -f .\experiencia-digital\compose.yaml up -d --build --wait --wait-timeout 120
docker compose -f .\lecturas\compose.yaml up -d --build --wait --wait-timeout 120
docker compose -f .\dispositivos\compose.yaml up -d --build --wait --wait-timeout 120
docker compose -f .\smartaudits\compose.yaml up -d --build --wait --wait-timeout 120
```

Detenerse en el primer fallo. No seguir levantando servicios para ocultar un error anterior.

Para levantar solo una aplicacion, usar `make -C <directorio> up` o el unico comando Compose correspondiente. Aclarar que un modulo remoto puede requerir al shell para autenticarse.

### 6. Validar sin exponer configuracion

Ejecutar:

```powershell
docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}"
```

Comprobar que los cinco contenedores esten `healthy`. Pedir a la persona los puertos locales no sensibles si difieren de los defaults; no leerlos desde `.env`.

Validar por HTTP:

1. Shell: `/` y `/actuator/health` deben responder.
2. Cada modulo: `/`, `/actuator/health`, `/api/module/manifest` y `/remote-entry.js` deben responder.
3. Entrar por el shell, iniciar sesion y montar cada modulo.

No considerar fallo que una API protegida responda `401` cuando se consulta sin JWT. En el arranque Compose normal, abrir directamente el frontend compilado de un modulo ejecuta un contexto standalone sin token; por eso puede mostrar `No fue posible consultar el modulo`. La prueba integrada valida entra por el shell.

### 7. Diagnosticar el primer fallo concreto

Usar unicamente estado y logs sanitizados:

```powershell
docker compose -f .\<aplicacion>\compose.yaml ps
docker compose -f .\<aplicacion>\compose.yaml logs --tail=100
```

No copiar logs completos al chat si contienen datos privados. Resumir el error y ocultar cualquier valor sensible que aparezca accidentalmente.

Clasificar antes de actuar:

- build o descarga de imagen;
- puerto ocupado;
- health check;
- conexion a SQL Server;
- issuer, JWKS o CORS;
- autenticacion esperada `401`;
- manifiesto, `remote-entry.js` o contrato del Custom Element.

No modificar codigo para corregir un problema de configuracion.

## Desarrollo standalone

Si la solicitud exige abrir los modulos directamente con lectura local, usar la ruta documentada:

```powershell
.\scripts\start-environment.ps1 -Mode Development
```

Este modo levanta cinco backends con perfil `dev` y cinco Vite. Los frontends quedan en `5173` a `5177` salvo overrides no sensibles. SmartAudits mantiene protegida la aprobacion humana.

Para un unico modulo, compilar su frontend y ejecutar su backend con `spring-boot.run.profiles=dev`, despues de que la persona haya inyectado las variables requeridas. No habilitar standalone en un entorno compartido o productivo.

## Apagar

Con Make:

```powershell
make down
```

Sin Make, ejecutar `docker compose -f <ruta-del-compose> down` para cada aplicacion levantada. Si se utilizo `scripts/start-environment.ps1`, apagar unicamente con:

```powershell
.\scripts\stop-environment.ps1
```

## Entrega

Informar de forma breve:

- ruta de arranque utilizada;
- aplicaciones levantadas y puertos publicos confirmados;
- health checks ejecutados;
- primer error concreto si algo fallo;
- pasos que quedaron en manos de la persona por contener secretos.

No afirmar que el stack funciona si solo cargo el HTML o si no se comprobo el montaje integrado desde el shell.
