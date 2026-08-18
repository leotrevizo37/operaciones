---
name: interfaces
description: "Extraer, copiar, portar o reutilizar de forma nativa las interfaces de Operaciones Duma: Resumen ICOS desde app-shell/frontend, Lecturas desde lecturas/frontend y Experiencia Digital desde experiencia-digital/frontend. Usar al preparar una copia privada para otro proyecto, convertir una interfaz en paquete o Custom Element, integrar estas vistas en otro frontend React y TypeScript o auditar que una exportacion conserva estructura, estilos, estados y contratos. Excluir siempre Dispositivos, SmartAudits, backends, datos y secretos salvo autorizacion expresa posterior."
---

# Reutilizar interfaces productivas Duma

## Alcance cerrado

Las unicas interfaces autorizadas son:

| Interfaz | Fuente canonica |
|---|---|
| Resumen ICOS | `app-shell/frontend` |
| Lecturas | `lecturas/frontend` |
| Experiencia Digital | `experiencia-digital/frontend` |

No copiar ni portar:

- `dispositivos/frontend`;
- `smartaudits/frontend`;
- ningun backend, SQL, dato, log, artifact, `.env`, credencial o configuracion privada;
- codigo de otras aplicaciones solo por semejanza.

Si la solicitud incluye una cuarta interfaz o cualquier backend, detenerse y pedir una autorizacion de alcance separada.

## Principio de copia nativa

Preferir siempre el codigo fuente React, TypeScript y CSS y sus contratos sobre:

- screenshots;
- HTML obtenido del navegador;
- bundles compilados de `dist` o `src/main/resources/static`;
- recreaciones visuales aproximadas;
- conversiones a imagenes o canvas.

No redisenar, modernizar, simplificar ni mezclar las tres interfaces. Conservar jerarquia, contenido, estados semanticos, responsive, accesibilidad y densidad existentes. Adaptar unicamente los bordes necesarios para compilar e integrarse en el destino.

## Seleccionar el modo de reutilizacion

Antes de copiar, confirmar la ruta local y privada del destino y elegir uno:

### Microfrontend intacto

Usar cuando el destino acepta Vite, React, TypeScript y Custom Elements.

Copiar el frontend seleccionado completo, excluyendo `node_modules`, resultados de pruebas, bundles y archivos generados. Mantener:

- `package.json` y `package-lock.json`;
- configuracion TypeScript, Vite, ESLint y Playwright;
- `index.html`;
- `src` y `e2e`.

Para Lecturas y Experiencia Digital, conservar `element.tsx`, Shadow DOM, CSS inline, nombre del Custom Element y handshake `1.0`.

### Vista React embebida

Usar cuando el destino ya tiene una aplicacion React y TypeScript.

Copiar unicamente el grafo fuente de la vista indicado en [references/mapa-de-fuentes.md](references/mapa-de-fuentes.md). Crear en el destino un adaptador delgado para `HostContext`; no sustituir el contrato por mocks permanentes ni hardcodear URLs o tokens.

Respetar las versiones y herramientas del destino. No reemplazar su `package.json`, lockfile, configuracion global o sistema de estilos si basta con agregar los archivos y dependencias estrictamente necesarias.

### Shell completo

Usar unicamente cuando el destino necesita conservar autenticacion, Resumen ICOS y carga de microfrontends.

Copiar `app-shell/frontend` como unidad fuente. No copiar `app-shell/backend` por implicacion. La integracion real seguira requiriendo que el destino implemente las APIs del shell o reciba autorizacion separada para reutilizar backend.

## Flujo de trabajo

### 1. Inspeccionar fuente y destino

- Confirmar que la fuente es este checkout y que el destino es privado y local.
- Revisar cambios existentes en ambos worktrees y preservarlos.
- No copiar aun si existen archivos con los mismos nombres y cambios no atribuibles a esta tarea.
- Identificar framework, version de React, TypeScript, bundler, routing y estrategia CSS del destino.
- Elegir el modo de reutilizacion con base en esa evidencia.

### 2. Construir un manifiesto previo

Enumerar antes de modificar:

- interfaz solicitada;
- archivos fuente exactos;
- archivos destino exactos;
- dependencias nuevas imprescindibles;
- adaptaciones de contrato necesarias;
- archivos excluidos.

El manifiesto debe nombrar explicitamente como excluidos `dispositivos` y `smartaudits`.

### 3. Copiar sin sobrescribir a ciegas

- Crear archivos nuevos mediante cambios auditables.
- Si un destino ya existe, fusionar solo los fragmentos necesarios.
- No reemplazar directorios completos ni eliminar codigo del destino.
- No copiar archivos generados, caches, artifacts o configuraciones privadas.
- No agregar comentarios, refactors, renombramientos o formato ajenos a la integracion.

Si se necesita copiar fuera del workspace autorizado, solicitar aprobacion antes de escribir.

### 4. Preservar el contrato visual y funcional

Mantener:

- estados `loading`, `ready`, `error`, `AVAILABLE`, `NO_DATA`, `NOT_SUPPORTED` y `UNAVAILABLE` cuando correspondan;
- periodos, filtros, timezone y tenant scope provenientes del contexto;
- `apiBaseUrl` y `auth.getAccessToken()` como fronteras de integracion;
- ausencia de dato como `—` o estado explicito, nunca como cero inventado;
- estilos y breakpoints originales;
- semantica de tablas, badges, verdictos, drill-downs y frescura;
- textos de privacidad y clasificacion academica existentes.

No enviar datos de negocio en eventos DOM ni agregar telemetria externa.

### 5. Preservar la integracion nativa

Para Lecturas y Experiencia Digital:

1. Mantener protocolo `1.0`.
2. Validar el `moduleId` esperado.
3. Registrar el Custom Element original una sola vez.
4. Conservar `setHostContext(context)`.
5. Emitir `duma:module-ready` con capacidades compatibles.
6. Mantener `bubbles: true` y `composed: true` en eventos.
7. Pedir el JWT mediante el contexto solo al consultar la API.

No sustituir el handshake por variables globales, atributos HTML con identidad o tokens embebidos.

Para Resumen ICOS, preservar `api.ts`, CSRF, sesion y `ModuleHost` si se reutiliza el shell completo. Para una copia puramente visual, aislar el componente mediante un adaptador en el destino y documentar que APIs siguen faltando; no simular que la autenticacion quedo implementada.

### 6. Adaptar estilos con el menor cambio

- En Custom Elements, conservar el Shadow DOM y `styles.css?inline`.
- En una vista React embebida, cargar el CSS una sola vez y comprobar colisiones reales antes de renombrar selectores.
- No traducir CSS a otra libreria ni introducir un design system nuevo.
- No consolidar los tres `styles.css`; cada interfaz conserva su identidad y alcance.

### 7. Validar

Ejecutar en cada frontend afectado o en el destino equivalente:

```powershell
npm.cmd ci
npm.cmd run test
npm.cmd run lint
npm.cmd run build
```

Si el destino ya tiene un lockfile y dependencias instaladas, respetar su flujo en vez de ejecutar `npm.cmd ci` indiscriminadamente.

Comprobar ademas:

- montaje sin errores de consola;
- vista desktop y mobile;
- loading, error y al menos un estado de datos real o fixture ya existente;
- ausencia de overflow horizontal accidental;
- contrato del Custom Element cuando aplique;
- `git diff --check` y diff limitado a los archivos del manifiesto.

No afirmar fidelidad completa si no se realizo inspeccion visual.

## Entrega

Informar:

- cual de las tres interfaces se reutilizo;
- modo elegido;
- archivos copiados y adaptados;
- contratos preservados;
- validaciones ejecutadas y no ejecutadas;
- confirmacion explicita de que Dispositivos y SmartAudits no se copiaron.

No publicar, desplegar, empaquetar para terceros, abrir PR, hacer commit o push sin autorizacion explicita.
