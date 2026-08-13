---
name: atender-smartaudits-review-queue
description: Implementar o mantener en una app web el flujo de revision humana de ctl.SmartauditsAiCommentReviewQueue para carlsjr: listar pendientes, abrir un modal, seleccionar una categoria valida y aprobar/promover una fila de forma transaccional hacia ctl.SmartauditsAiCommentLookup. Usar al crear la UI, endpoints, queries SQL Server, validaciones o pruebas de la review queue de SmartAudits. Tambien usar para operar o diagnosticar ese flujo. No usar para otros user_codes, entrenar modelos ni reclasificar historicos.
---

# Atender la review queue de SmartAudits

## Implementar el flujo en una app web

Cuando la solicitud sea implementar esta funcionalidad en una app web, no pedir decisiones que ya estén resueltas aquí. Inspeccionar y reutilizar los patrones existentes de rutas, acceso a SQL Server, autenticacion, modales, errores y pruebas. Mantener el cambio mínimo: una lista de pendientes, un modal, un endpoint de lectura y un endpoint de promoción. No agregar dependencias ni refactors.

El usuario final debe poder:

1. Ver filas `PENDING`.
2. Abrir una fila en un modal.
3. Seleccionar una categoria humana.
4. Escribir una nota opcional.
5. Pulsar `Aprobar y promover`.
6. Ver confirmación cuando esa misma fila quede `PROMOTED` y registrada en el lookup como `HUMAN`.

La llave de una fila es siempre `(NormalizedCommentHash, AiResult)`. No usar sólo el hash, `LastPlanResultId` ni `LastEvidencePhotoId` como identificador.

### Listar pendientes

Implementar una consulta paginada y parametrizada equivalente a:

```sql
SELECT
    NormalizedCommentHash,
    AiResult,
    SampleComment,
    NormalizedComment,
    CandidateCount,
    FirstSeenAt,
    LastSeenAt,
    LastPlanResultId,
    LastEvidencePhotoId,
    SuggestedCategory,
    SuggestedMethod,
    SuggestedConfidence,
    ReviewStatus,
    COUNT_BIG(*) OVER () AS TotalCount
FROM ctl.SmartauditsAiCommentReviewQueue
WHERE UPPER(ReviewStatus) = N'PENDING'
ORDER BY CandidateCount DESC, LastSeenAt DESC, NormalizedCommentHash, AiResult
OFFSET @Offset ROWS
FETCH NEXT @PageSize ROWS ONLY;
```

Devolver `items` y `totalCount`. Limitar `pageSize` en el servidor. Este orden prioriza recurrencia y mantiene paginación determinista.

### Construir el modal

Mostrar como sólo lectura:

- `SampleComment` como texto principal.
- `NormalizedComment` como referencia.
- `CandidateCount`, `FirstSeenAt` y `LastSeenAt`.
- `SuggestedCategory`, `SuggestedMethod` y `SuggestedConfidence` sólo como apoyo.
- `LastPlanResultId` y `LastEvidencePhotoId` para trazabilidad.

Conservar `NormalizedCommentHash` y `AiResult` en el estado interno; no mostrarlos como inputs editables.

Usar un selector obligatorio con únicamente estas categorias promovibles:

```text
IMAGEN_NO_PROCESABLE
IMAGEN_NO_LEGIBLE
FUERA_DE_RANGO
INCUMPLIMIENTO_LIMPIEZA
INCUMPLIMIENTO_GENERAL
```

No ofrecer `SIN_CLASIFICAR`, porque guardarla como etiqueta humana impediría que el comentario vuelva a la cola. No ofrecer `CUMPLIMIENTO`, porque los candidatos de esta cola tienen `AiResult = 0`.

Preseleccionar `SuggestedCategory` sólo si pertenece a esas cinco opciones. En otro caso dejar el selector vacío. Incluir `ReviewNotes` opcional con máximo de 1000 caracteres. Obtener `ReviewedBy` de la identidad autenticada en el servidor; no aceptar un campo editable para esa identidad.

El botón `Aprobar y promover` debe permanecer deshabilitado sin categoria o durante el request. Retirar la fila de la lista únicamente después del éxito. Ante conflicto `409`, refrescar la cola.

Enviar sólo:

```json
{
  "normalizedCommentHash": "sha256-de-64-caracteres",
  "aiResult": 0,
  "resultCategory": "INCUMPLIMIENTO_GENERAL",
  "reviewNotes": "Nota opcional"
}
```

No aceptar desde el cliente `reviewedBy`, `reviewStatus`, método, confianza ni versión de modelo.

### Validar el endpoint

Validar en el servidor:

- Hash hexadecimal de exactamente 64 caracteres.
- `aiResult = 0`.
- Categoria incluida en las cinco opciones promovibles.
- Nota nula o de hasta 1000 caracteres.
- Identidad autenticada disponible y de hasta 255 caracteres.

Usar parámetros del driver SQL para todos los valores. No interpolar strings.

### Aprobar y promover la fila seleccionada

En la app web, hacer aprobación y promoción en una sola transacción acotada por la llave compuesta. No lanzar el job global `112_smartaudits_comment_lookup_promotion` desde el modal: ese job toma todas las filas `APPROVED`, no únicamente la seleccionada.

Ejecutar una query parametrizada con `@NormalizedCommentHash`, `@AiResult`, `@ReviewedResultCategory`, `@ReviewedBy` y `@ReviewNotes` siguiendo este contrato:

```sql
SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @CurrentStatus NVARCHAR(20);

SELECT @CurrentStatus = UPPER(ReviewStatus)
FROM ctl.SmartauditsAiCommentReviewQueue WITH (UPDLOCK, HOLDLOCK)
WHERE NormalizedCommentHash = @NormalizedCommentHash
  AND AiResult = @AiResult;

IF @CurrentStatus IS NULL
    THROW 50001, N'No se encontro la fila de SmartAudits.', 1;

IF @CurrentStatus = N'PROMOTED'
BEGIN
    IF EXISTS (
        SELECT 1
        FROM ctl.SmartauditsAiCommentLookup
        WHERE NormalizedCommentHash = @NormalizedCommentHash
          AND AiResult = @AiResult
          AND ResultCategory = @ReviewedResultCategory
          AND UPPER(ClassificationMethod) = N'HUMAN'
    )
    BEGIN
        SELECT N'PROMOTED' AS ReviewStatus, CAST(1 AS BIT) AS Idempotent;
        COMMIT TRANSACTION;
        RETURN;
    END;

    THROW 50002, N'La fila ya fue promovida con otro resultado.', 1;
END;

IF @CurrentStatus NOT IN (N'PENDING', N'APPROVED')
    THROW 50003, N'La fila no tiene un estado promovible.', 1;

UPDATE ctl.SmartauditsAiCommentReviewQueue
SET
    ReviewedResultCategory = @ReviewedResultCategory,
    ReviewedBy = @ReviewedBy,
    ReviewedAt = SYSUTCDATETIME(),
    ReviewNotes = @ReviewNotes,
    ReviewStatus = N'APPROVED',
    ModifiedAt = SYSUTCDATETIME()
WHERE NormalizedCommentHash = @NormalizedCommentHash
  AND AiResult = @AiResult;

MERGE ctl.SmartauditsAiCommentLookup AS target
USING (
    SELECT NormalizedCommentHash, NormalizedComment, AiResult, ReviewedResultCategory
    FROM ctl.SmartauditsAiCommentReviewQueue
    WHERE NormalizedCommentHash = @NormalizedCommentHash
      AND AiResult = @AiResult
      AND UPPER(ReviewStatus) = N'APPROVED'
) AS source
    ON target.NormalizedCommentHash = source.NormalizedCommentHash
    AND target.AiResult = source.AiResult
WHEN MATCHED THEN
    UPDATE SET
        target.NormalizedComment = source.NormalizedComment,
        target.ResultCategory = source.ReviewedResultCategory,
        target.ClassificationMethod = N'HUMAN',
        target.ClassifierModelVersion = NULL,
        target.ClassifierConfidence = 1.0,
        target.ModifiedAt = SYSUTCDATETIME()
WHEN NOT MATCHED BY TARGET THEN
    INSERT (
        NormalizedCommentHash,
        NormalizedComment,
        AiResult,
        ResultCategory,
        ClassificationMethod,
        ClassifierModelVersion,
        ClassifierConfidence
    )
    VALUES (
        source.NormalizedCommentHash,
        source.NormalizedComment,
        source.AiResult,
        source.ReviewedResultCategory,
        N'HUMAN',
        NULL,
        1.0
    );

UPDATE ctl.SmartauditsAiCommentReviewQueue
SET ReviewStatus = N'PROMOTED', ModifiedAt = SYSUTCDATETIME()
WHERE NormalizedCommentHash = @NormalizedCommentHash
  AND AiResult = @AiResult
  AND UPPER(ReviewStatus) = N'APPROVED';

IF @@ROWCOUNT <> 1
    THROW 50004, N'No fue posible finalizar la promocion.', 1;

SELECT
    q.NormalizedCommentHash,
    q.AiResult,
    q.ReviewStatus,
    q.ReviewedResultCategory,
    q.ReviewedBy,
    q.ReviewedAt,
    q.ReviewNotes,
    l.ResultCategory,
    l.ClassificationMethod,
    l.ClassifierModelVersion,
    l.ClassifierConfidence,
    CAST(0 AS BIT) AS Idempotent
FROM ctl.SmartauditsAiCommentReviewQueue AS q
INNER JOIN ctl.SmartauditsAiCommentLookup AS l
    ON l.NormalizedCommentHash = q.NormalizedCommentHash
    AND l.AiResult = q.AiResult
WHERE q.NormalizedCommentHash = @NormalizedCommentHash
  AND q.AiResult = @AiResult;

COMMIT TRANSACTION;
```

Mapear fila inexistente a `404`, conflicto de estado o categoria a `409`, validación a `400` o `422`, y éxito a `200`.

La operación es correcta únicamente si termina con:

- Cola en `PROMOTED`.
- `ReviewedResultCategory = ResultCategory`.
- Lookup con `ClassificationMethod = 'HUMAN'`.
- `ClassifierModelVersion IS NULL`.
- `ClassifierConfidence = 1.0`.

La misma petición debe ser idempotente: si la llave ya está `PROMOTED` con la misma categoria humana, devolver éxito sin volver a modificarla.

### Pruebas mínimas de la app

1. La lista devuelve únicamente `PENDING` en el orden esperado.
2. Una categoria inválida se rechaza sin ejecutar SQL.
3. Una fila `PENDING` termina `PROMOTED` y el lookup queda `HUMAN` con confianza `1.0`.
4. Sólo cambia la llave compuesta solicitada.
5. Repetir la misma petición devuelve éxito idempotente.
6. Un fallo del `MERGE` revierte toda la transacción.

No entrenar modelos, ejecutar jobs `110`/`111` ni reclasificar el histórico desde el submit del modal.

## Alcance y limites

- Trabajar exclusivamente con las tablas SmartAudits de `carlsjr`.
- No modificar `stg.SmartauditsAiCommentReviewQueue`, otros `user_codes`, contenedores ni bases.
- No aprobar múltiples filas mediante un `UPDATE` abierto por estado, sugerencia o confianza.
- No enviar comentarios, datos ni código a servicios externos.
- No leer `.env`, secretos o credenciales.
- No entrenar modelos ni ejecutar los jobs `110` o `111` desde el modal.
- No afirmar que esta promoción reclasifica el histórico de `dwh.factSmartauditsCategories`; sólo actualiza la cola y el lookup.
- Tratar cualquier backfill o corrección histórica como otra tarea que requiere autorización explícita.

## Fuentes locales de verdad

Si el contrato pudo cambiar, revisar únicamente:

- `sql/init/102_ctl_stg_SmartauditsAiCommentReviewQueue.sql`
- `sql/init/100_ctl_SmartauditsAiCommentLookup.sql`
- `dagster/carlsjr/src/carlsjr/defs/resources/sql_server.py`, función `build_smartaudits_comment_lookup_promotion_sql`
- `dagster/carlsjr/src/carlsjr/defs/transformations/smartaudits_categories.py`

Si esas fuentes contradicen esta skill, detener cualquier mutación y explicar la diferencia concreta. No pedir información que ya esté definida en esta skill o pueda obtenerse de los patrones existentes de la app.
