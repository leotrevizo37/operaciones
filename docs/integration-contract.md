# Contrato shell-microfrontend

## Version

El protocolo inicial exige la version `1.0`. Cualquier version distinta bloquea el montaje hasta que exista una politica explicita de compatibilidad.

## Manifiesto

Cada backend publica `GET /api/module/manifest`. El shell conserva las URLs de despliegue, mientras el backend remoto conserva identidad y clasificacion del modulo.

Campos requeridos:

- `protocolVersion`
- `moduleId`
- `displayName`
- `customElement`
- `remoteEntryUrl`
- `apiBaseUrl`
- `releaseStage`
- `dataEnvironment`
- `freshnessMode`
- `clearance`
- `tenantScope`
- `capabilities`

## Contexto del host

El shell llama una sola vez `element.setHostContext(context)` y puede repetirla al cambiar tenant, periodo, locale o zona horaria. El contexto no se pasa por atributos HTML porque contiene funciones.

```ts
type ModuleHostContext = {
  protocolVersion: "1.0"
  moduleId: string
  locale: "es-MX"
  timezone: string
  tenantIds: string[]
  period: { from: string; to: string }
  identity: {
    subject: string
    displayName: string
    roles: string[]
    permissions: string[]
    tenantScope: string[]
  }
  apiBaseUrl: string
  auth: {
    getAccessToken: (moduleId: string) => Promise<string>
  }
  navigate: (target: { moduleId: string; path?: string }) => void
}
```

Los modulos deben considerar `roles`, `permissions` y `tenantScope` listas vacias validas. Esta revision no oculta controles por permisos ni interpreta esas listas como autorizacion.

## Handshake

1. El shell obtiene del registro interno los campos requeridos del manifiesto.
2. Importa `remoteEntryUrl` como ESM.
3. Espera el Custom Element declarado.
4. Inserta el elemento y asigna el contexto.
5. El modulo valida version e identidad del contexto.
6. El modulo emite `duma:module-ready`.
7. El shell verifica `moduleId`, `protocolVersion` y capacidades.
8. El modulo solicita un token solo cuando necesita llamar su API.

Si el evento no llega dentro del timeout configurado, el shell muestra un estado de integracion fallida sin retirar los demas modulos.

## Eventos DOM

Todos los eventos son `CustomEvent`, usan `bubbles: true` y `composed: true`.

| Evento | Emisor | Contenido |
|---|---|---|
| `duma:module-ready` | Modulo | version, id y capacidades |
| `duma:module-error` | Modulo | codigo sanitizado y recuperabilidad |
| `duma:navigate` | Modulo | destino de drill-down |
| `duma:telemetry` | Modulo | nombre allowlist, resultado y duracion |
| `duma:context-changed` | Shell | nuevo alcance y periodo |

No se incluyen filas, comentarios, tokens, credenciales ni payloads de negocio en eventos de telemetria.

## Token por modulo

`POST /api/integration/token` exige sesion y proteccion CSRF. El cuerpo contiene solamente `moduleId`. El token usa RS256, vida corta y `aud` igual al modulo solicitado. Los backends rechazan tokens con otra audiencia aunque la firma sea valida.
