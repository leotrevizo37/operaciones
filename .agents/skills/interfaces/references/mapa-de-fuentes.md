# Mapa de fuentes productivas

## Resumen ICOS

Fuente: `app-shell/frontend`.

### Copia de vista React

| Archivo | Responsabilidad |
|---|---|
| `src/App.tsx` | Resumen ICOS, navegacion, filtros, sesion y composicion del shell |
| `src/styles.css` | Sistema visual y responsive del shell |
| `src/types.ts` | Contratos de sesion, modulos, frescura y contexto |
| `src/api.ts` | Fetch autenticado y CSRF |
| `src/ModuleBadge.tsx` | Badges de etapa, datos y disponibilidad |
| `src/ModuleHost.tsx` | Carga ESM, Custom Element, contexto y handshake |

Para una copia exclusivamente visual del Resumen, inspeccionar el grafo real de imports y separar mediante un adaptador local. No eliminar autenticacion o integracion del fuente original para facilitar la copia.

### Copia de shell completo

Copiar todo `app-shell/frontend`, excepto:

- `node_modules`;
- `playwright-report`;
- `test-results`;
- `dist` y cualquier salida generada.

El backend no esta autorizado por esta skill.

## Lecturas

Fuente: `lecturas/frontend`.

### Nucleo de la interfaz

| Archivo | Responsabilidad |
|---|---|
| `src/App.tsx` | Vista operacional y estados de carga, error y cobertura |
| `src/styles.css` | Estilos, responsive y jerarquia visual |
| `src/metrics.ts` | Metricas derivadas y etiquetas de estado |
| `src/types.ts` | Contratos del dashboard y `HostContext` |
| `src/element.tsx` | Custom Element y Shadow DOM |
| `src/main.tsx` | Entrada standalone local |

Para mantenerla como microfrontend, incluir tambien `package.json`, `package-lock.json`, `vite.config.ts`, configuraciones TypeScript, ESLint, `index.html`, pruebas unitarias y `e2e`.

No copiar la salida generada en `backend/src/main/resources/static`.

## Experiencia Digital

Fuente: `experiencia-digital/frontend`.

### Nucleo de la interfaz

| Archivo | Responsabilidad |
|---|---|
| `src/App.tsx` | Experiencia, disponibilidad, estados y drill-downs |
| `src/DataBadges.tsx` | Badges de etapa y entorno de datos |
| `src/styles.css` | Estilos, responsive y jerarquia visual |
| `src/metrics.ts` | Metricas derivadas y cobertura |
| `src/types.ts` | Contratos del dashboard y `HostContext` |
| `src/element.tsx` | Custom Element y Shadow DOM |
| `src/main.tsx` | Entrada standalone local |

Para mantenerla como microfrontend, incluir tambien `package.json`, `package-lock.json`, `vite.config.ts`, configuraciones TypeScript, ESLint, `index.html`, pruebas unitarias y `e2e`.

No copiar la salida generada en `backend/src/main/resources/static`.

## Contrato compartido que no debe degradarse

- Protocolo `1.0`.
- `HostContext` con locale, timezone, tenants, periodo, identidad, `apiBaseUrl`, autenticacion y navegacion.
- Importacion ESM de `remote-entry.js`.
- Registro idempotente del Custom Element.
- Eventos `duma:module-ready` y `duma:module-error` sanitizados.
- JWT de audiencia exclusiva por modulo.
- Ausencia de datos representada por cobertura explicita, no por ceros artificiales.

La fuente versionada del contrato es `docs/integration-contract.md`. Si contradice este mapa, seguir el contrato versionado y ajustar la copia minima.

## Exclusiones explicitas

No incluir en el manifiesto de copia:

```text
dispositivos/frontend
smartaudits/frontend
*/backend
*/.env
artifacts
.runtime
**/node_modules
**/dist
**/src/main/resources/static
**/playwright-report
**/test-results
```
