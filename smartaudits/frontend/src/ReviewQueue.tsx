import { useCallback, useEffect, useState } from 'react'
import { isPromotable, PROMOTABLE_CATEGORIES } from './metrics'
import type { HostContext, PromotableCategory, ReviewQueueItem, ReviewQueuePage } from './types'

const categoryLabel = (category: string) => ({
  IMAGEN_NO_PROCESABLE: 'Imagen no procesable',
  IMAGEN_NO_LEGIBLE: 'Imagen no legible',
  FUERA_DE_RANGO: 'Fuera de rango',
  INCUMPLIMIENTO_LIMPIEZA: 'Incumplimiento de limpieza',
  INCUMPLIMIENTO_GENERAL: 'Incumplimiento general',
}[category] ?? category)

const dateTime = (value: string | null) => value
  ? new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(value))
  : '—'

export default function ReviewQueue({ context, token }: { context: HostContext; token: string }) {
  const [data, setData] = useState<ReviewQueuePage | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'locked' | 'error'>(token ? 'loading' : 'locked')
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<ReviewQueueItem | null>(null)
  const [category, setCategory] = useState<PromotableCategory | ''>('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState('')

  const load = useCallback(async (targetPage: number) => {
    if (!token) {
      setState('locked')
      return
    }
    setState('loading')
    try {
      const response = await fetch(`${context.apiBaseUrl}/api/smartaudits/review-queue?page=${targetPage}&pageSize=25`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.status === 401 || response.status === 403) {
        setState('locked')
        return
      }
      if (!response.ok) throw new Error('queue_failed')
      setData(await response.json() as ReviewQueuePage)
      setPage(targetPage)
      setState('ready')
    } catch {
      setState('error')
    }
  }, [context.apiBaseUrl, token])

  useEffect(() => { void load(0) }, [load])
  useEffect(() => {
    if (!selected) return
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape' && !submitting) setSelected(null) }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [selected, submitting])

  const open = (item: ReviewQueueItem) => {
    setSelected(item)
    setCategory(isPromotable(item.suggestedCategory) ? item.suggestedCategory : '')
    setNotes('')
    setNotice('')
  }

  const promote = async () => {
    if (!selected || !category || submitting) return
    setSubmitting(true)
    setNotice('')
    try {
      const response = await fetch(`${context.apiBaseUrl}/api/smartaudits/review-queue/promote`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          normalizedCommentHash: selected.normalizedCommentHash,
          aiResult: selected.aiResult,
          resultCategory: category,
          reviewNotes: notes.trim() || null,
        }),
      })
      if (response.status === 409 || response.status === 404) {
        setSelected(null)
        setNotice(response.status === 409
          ? 'La fila cambió mientras se revisaba. La cola fue actualizada.'
          : 'La fila ya no existe. La cola fue actualizada.')
        await load(page)
        return
      }
      if (!response.ok) throw new Error('promotion_failed')
      setSelected(null)
      setNotice('La fila quedó PROMOTED y el lookup fue registrado como HUMAN con confianza 1.0.')
      await load(page)
    } catch {
      setNotice('No fue posible promover la fila. No se retiró de la cola.')
    } finally {
      setSubmitting(false)
    }
  }

  if (state === 'locked') {
    return <section className="queue-state locked"><strong>La cola requiere identidad del shell</strong><p>El modo independiente conserva la analítica de lectura, pero no habilita promociones sin JWT.</p></section>
  }
  if (state === 'error') {
    return <section className="queue-state error"><strong>La cola no está disponible</strong><p>No se modificó ninguna fila. Reintente cuando la conexión esté disponible.</p><button type="button" onClick={() => void load(page)}>Reintentar</button></section>
  }

  return <section className="queue">
    <div className="queue-heading">
      <div><span>ACCIÓN HUMANA · CARLS JR</span><h2>Comentarios pendientes de clasificación</h2><p>Ordenados por recurrencia y última aparición.</p></div>
      <strong>{data?.totalCount ?? '—'} pendientes</strong>
    </div>
    {notice && <div className="notice" role="status">{notice}</div>}
    {state === 'loading'
      ? <div className="queue-loading">Actualizando cola…</div>
      : data?.items.length
        ? <div className="queue-list">{data.items.map((item) => <article key={`${item.normalizedCommentHash}-${item.aiResult}`}>
            <div><span>{item.candidateCount} candidatos</span><strong>{item.sampleComment || 'Comentario de muestra no disponible'}</strong><small>Última aparición {dateTime(item.lastSeenAt)}</small></div>
            <div><span>Sugerencia</span><strong>{item.suggestedCategory ? categoryLabel(item.suggestedCategory) : 'Sin sugerencia válida'}</strong><small>{item.suggestedMethod || 'Sin método'} · {item.suggestedConfidence == null ? 'sin confianza' : `${(item.suggestedConfidence * 100).toFixed(1)}%`}</small></div>
            <button type="button" onClick={() => open(item)}>Revisar</button>
          </article>)}</div>
        : <div className="queue-empty"><strong>No hay filas PENDING</strong><span>La cola queda lista para nuevos candidatos.</span></div>}
    {data && <div className="pagination"><button type="button" disabled={page === 0 || state === 'loading'} onClick={() => void load(page - 1)}>Anterior</button><span>Página {page + 1} de {Math.max(1, Math.ceil(data.totalCount / data.pageSize))}</span><button type="button" disabled={(page + 1) * data.pageSize >= data.totalCount || state === 'loading'} onClick={() => void load(page + 1)}>Siguiente</button></div>}
    {selected && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) setSelected(null) }}>
      <section className="review-modal" role="dialog" aria-modal="true" aria-labelledby="review-title">
        <div className="modal-heading"><div><span>REVISIÓN HUMANA</span><h2 id="review-title">Aprobar y promover comentario</h2></div><button type="button" aria-label="Cerrar" disabled={submitting} onClick={() => setSelected(null)}>×</button></div>
        <div className="comment-block"><span>Comentario de muestra</span><strong>{selected.sampleComment || 'Sin comentario de muestra'}</strong></div>
        <div className="normalized"><span>Comentario normalizado</span><p>{selected.normalizedComment}</p></div>
        <dl className="trace-grid">
          <div><dt>Recurrencias</dt><dd>{selected.candidateCount}</dd></div>
          <div><dt>Primera aparición</dt><dd>{dateTime(selected.firstSeenAt)}</dd></div>
          <div><dt>Última aparición</dt><dd>{dateTime(selected.lastSeenAt)}</dd></div>
          <div><dt>PlanResultId</dt><dd>{selected.lastPlanResultId ?? '—'}</dd></div>
          <div><dt>EvidencePhotoId</dt><dd>{selected.lastEvidencePhotoId ?? '—'}</dd></div>
          <div><dt>Apoyo del clasificador</dt><dd>{selected.suggestedCategory ? categoryLabel(selected.suggestedCategory) : 'Sin sugerencia'} · {selected.suggestedMethod || 'sin método'} · {selected.suggestedConfidence == null ? 'sin confianza' : `${(selected.suggestedConfidence * 100).toFixed(1)}%`}</dd></div>
        </dl>
        <label className="field"><span>Categoría humana obligatoria</span><select required value={category} onChange={(event) => setCategory(event.target.value as PromotableCategory | '')}><option value="">Seleccione una categoría</option>{PROMOTABLE_CATEGORIES.map((item) => <option key={item} value={item}>{categoryLabel(item)}</option>)}</select></label>
        <label className="field"><span>Nota opcional</span><textarea maxLength={1000} rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Contexto de la decisión, sin datos sensibles adicionales." /><small>{notes.length}/1000</small></label>
        <div className="modal-warning"><strong>Esta acción es transaccional.</strong><span>La fila terminará PROMOTED y el lookup quedará HUMAN con confianza 1.0. No ejecuta jobs ni reclasifica históricos.</span></div>
        <div className="modal-actions"><button type="button" className="secondary" disabled={submitting} onClick={() => setSelected(null)}>Cancelar</button><button type="button" className="primary" disabled={!category || submitting} onClick={() => void promote()}>{submitting ? 'Promoviendo…' : 'Aprobar y promover'}</button></div>
      </section>
    </div>}
  </section>
}
