---
name: dashboard-storytelling
description: >-
  Playbook para diseñar, estructurar, revisar y auditar dashboards que cuentan
  una historia y terminan en decisión. Norma el pipeline completo: pregunta de
  negocio → KPIs (baseline, umbral, dirección de bondad) → insight → selección
  de gráfica → jerarquía visual → narrativa → acción. Incluye patrones de
  escala multi-unidad × multi-módulo (diseño por excepción, matriz de
  semáforos, scores compuestos, benchmark interno vs. mediana de cohorte,
  drill paths), honestidad visual no negociable y auditoría de ciclo de vida.
  ALWAYS trigger al diseñar, estructurar, analizar o revisar CUALQUIER
  dashboard, reporte de KPIs o vista de métricas, de cualquier
  dominio; ante "arma el dashboard de X", "¿qué KPIs pongo?", "¿qué gráfica
  uso?", "¿cómo presento/cuento estos datos?", "revisa/audita este dashboard";
  y al detectar dashboards sobrecargados o sin narrativa. Este skill decide
  QUÉ mostrar y QUÉ historia cuenta — agnóstico de herramienta de BI y de
  sistema de diseño.
---

# Dashboard Storytelling — Dashboards que Cuentan Historias

> Un dashboard no es una colección de gráficas. Es una decisión esperando a tomarse.
> Este skill norma el pipeline completo: **pregunta → KPI → insight → gráfica → jerarquía → narrativa → acción.**
> Es agnóstico de herramienta y de dominio. Norma el *qué mostrar y qué historia cuenta*; el sistema de diseño visual de cada equipo (tokens, componentes, marca) se aplica encima sin conflicto.

**Fórmula madre:** `DATA (¿qué pasó?) → INSIGHT (¿por qué?) → NARRATIVE (¿qué significa?) → DECISION (¿qué hacemos?)`

Si un dashboard responde solo la primera pregunta, es un reporte. Si responde las cuatro, es una herramienta de decisión.

---

## MODOS DE OPERACIÓN

Identificar el modo antes de aplicar el skill. Cada modo usa secciones distintas:

| Modo | Trigger típico | Secciones a aplicar |
|---|---|---|
| **Diseñar** — dashboard nuevo desde cero | "arma el dashboard de X", "necesitamos una vista de Y" | Pipeline completo: Fases 1→6, + Sección 9 si es multi-unidad, + checklist (Sección 11) antes de entregar |
| **Revisar** — dashboard existente | "revisa/critica este dashboard", "¿por qué nadie lo usa?" | Correr checklist (Sección 11) como diagnóstico, reportar fallas por bloque, proponer fixes anclados en la fase correspondiente |
| **Auditar** — higiene periódica de dashboards vivos | "audita los dashboards de X", revisión semestral | Sección 10 standalone: 4 preguntas por KPI, asignar destino (retirar/degradar/fusionar/promover) |
| **Consultar** — pregunta puntual | "¿qué gráfica uso para X?", "¿cómo muestro Y?" | Ir directo a la sección relevante (típicamente Fase 4 o 9.7); no desplegar el pipeline completo |

Regla de proporcionalidad: una pregunta puntual recibe una respuesta puntual con referencia a la fase — no el pipeline entero.

---

## FASE 1 — Audiencia y pregunta de negocio

### 1.1 Nadie construye "un dashboard". Se construye una respuesta para alguien.

Tres arquetipos de audiencia, tres dashboards distintos con los mismos datos:

| Audiencia | Pregunta que hace | Necesita | Densidad |
|---|---|---|---|
| **Ejecutivo** | ¿Vamos bien? ¿Dónde invertir? | 3–5 KPIs de alto nivel, tendencias, comparativos | Muy baja |
| **Manager** | ¿Cómo va mi equipo vs. meta? ¿Qué requiere atención? | Breakdowns, targets, insights accionables | Media |
| **Operativo** | ¿Qué está pendiente? ¿Qué hago ahora? | Detalle, listas, dato en tiempo casi real | Alta |

Regla: si no puedes nombrar al usuario y la decisión que va a tomar con la pantalla, no estás listo para construir.

### 1.2 De request vago a preguntas accionables

"Hazme un dashboard de ventas" no es un brief. Es la ausencia de uno. Descomponer siempre:

| Request vago | Preguntas de negocio reales | KPIs que emergen |
|---|---|---|
| "Ventas van mal" | ¿Por qué cayeron el mes pasado? ¿Qué producto/región contribuyó más a la caída? | Ventas totales, crecimiento %, ventas por producto/región |
| "Retención está baja" | ¿Qué segmentos tienen la peor retención? ¿Cuál es la tendencia? | Retention rate, churn, nuevos vs. recurrentes |
| "Mejorar marketing" | ¿Qué campañas convierten más? ¿Cuál es nuestro CPA? | Conversion rate, CPA, ROI por campaña |
| "La utilidad no mejora" | ¿Qué está presionando el margen? ¿Qué costos suben? | Gross profit, margen %, gastos operativos |

**Cadena causal:** buenas preguntas → dato correcto → insights correctos → mejores decisiones. La calidad del dashboard se decide aquí, antes de tocar la herramienta.

---

## FASE 2 — Definición de KPIs (el hueco que nadie documenta)

Un número solo no es un KPI. Cada KPI del dashboard necesita cinco atributos definidos **antes** de mostrarse:

1. **Definición operativa única.** "Cliente activo" significa lo mismo para ventas, marketing y finanzas. Una definición, un cálculo, un número. (Si esto no existe, el problema es de gobernanza de datos, no de dashboard — resuélvelo primero o el dashboard institucionaliza la confusión.)
2. **Dueño.** Alguien responde por ese dato y su calidad.
3. **Baseline de comparación.** Un valor sin "¿vs. qué?" no comunica nada. Elegir explícitamente: vs. meta, vs. periodo anterior, vs. mismo periodo año pasado, vs. benchmark externo, vs. **la propia red** (mediana del cohorte — ver 9.7). Un KPI puede llevar más de uno, pero al menos uno **siempre**. En contextos multi-unidad, el par más diagnóstico es meta + red: cruzados distinguen problema local de problema sistémico.
4. **Umbral y semántica.** ¿A partir de qué valor esto es ámbar? ¿Rojo? ¿Quién decidió ese umbral y con qué criterio? Sin umbral, el color es decoración.
5. **Dirección de bondad.** ¿Subir es bueno o malo? Churn ↓ = bueno; Revenue ↑ = bueno. Parece obvio hasta que alguien pinta de verde un costo que subió.

**Anti-patrón:** el "KPI huérfano" — número grande, sin delta, sin comparación, sin color con significado. Es el equivalente visual de decir "82,456" y quedarse callado.

---

## FASE 3 — Encontrar el insight

### 3.1 Los datos no hablan. Se les interroga.

Cuatro cosas que buscar en cualquier dataset:

- **Tendencias** — ¿qué cambia en el tiempo?
- **Patrones** — ¿qué se repite? (estacionalidad, ciclos, horarios pico)
- **Outliers** — ¿qué se sale del resto? (el "abril cayó a 65k" que arranca la historia)
- **Relaciones** — ¿qué variables se mueven juntas?

Y cuatro preguntas que el analista se hace siempre: ¿qué está cambiando?, ¿qué es inusual?, ¿qué lo causó?, ¿por qué debería importarle a alguien?

### 3.2 Disciplina de analista (resumen operativo)

- **Hechos primero, conclusiones después.** "Las ventas cayeron porque el producto no gusta" es un supuesto. "¿Cayó el tráfico? ¿La conversión? ¿Cambió el precio? ¿Se acabó el stock? ¿Paró el marketing?" son preguntas verificables.
- **Cuestiona tu primera explicación.** "Marketing falló" → "¿cuáles son TODAS las razones posibles?" El insight real suele estar dos preguntas más adentro (ej: la conversión cayó por un bug en checkout, no por la campaña).
- **Descompón el problema grande.** "Cayó el revenue" = ¿menos visitas? × ¿menos compran? × ¿gastan menos? Revisa cada factor por separado, identifica el que cambió, enfócate ahí.
- **Insight ≠ dato.** "Tráfico subió 40%" es dato. "Atraemos visitantes pero los perdemos antes de comprar" es insight. El insight conecta dos hechos y apunta a una causa.

---

## FASE 4 — Elegir la gráfica

### 4.1 Tabla de decisión: la pregunta elige la gráfica

| Tu pregunta | Gráfica | Regla de oro | Evitar cuando |
|---|---|---|---|
| ¿Cómo cambia X en el tiempo? | **Línea** | Si el tiempo va en X, usa línea | Comparas categorías |
| ¿Qué categoría es mayor? | **Barras** | Comparar categorías → empieza con barras | Muestras tendencia temporal |
| ¿Cómo se divide el todo? | **Pie / dona** | Úsalo con moderación; responde UNA pregunta | >5–6 rebanadas, diferencias pequeñas, tendencias |
| ¿X afecta a Y? | **Scatter** | "¿Does X affect Y?" → scatter | Rankings o categorías |
| ¿Cómo se distribuyen los valores? | **Histograma** | Entiende la forma del dato antes de concluir | <30 puntos, comparar categorías |
| ¿Qué grupo es más consistente? | **Box plot** | Comparar distribuciones, no solo promedios | <10 puntos por grupo, valores exactos |
| ¿Qué patrón hay entre dos dimensiones? | **Heatmap** | El color revela patrones, no decora | Una sola variable, valores precisos importan |
| ¿Qué contribuye más en una jerarquía? | **Treemap** | "¿Qué contribuye más?" en cada nivel | <5 categorías, sin jerarquía, tendencias |
| ¿Cómo llegamos de A a B? (puentes) | **Waterfall** | Descomponer un cambio en sus drivers | El cambio no tiene componentes aditivos |
| ¿Dónde se pierde la gente en un proceso? | **Funnel** | Etapas secuenciales con caída | Etapas no secuenciales |
| ¿Valores exactos, muchas dimensiones? | **Tabla** | La gráfica más subestimada. Precisión > forma | El patrón importa más que el valor |

**Tablas bien hechas** (porque nadie las documenta): alineación derecha para números, mismo # de decimales por columna, orden default con intención (peor-primero o mayor-primero, no alfabético), sparkline opcional por fila, encabezados fijos si >8 filas, máximo ~7 columnas visibles.

### 4.2 Anti-charts (prohibidos o casi)

- **Gauge / velocímetro** — ocupa 10x el espacio de un número con color de umbral y comunica lo mismo.
- **3D de cualquier tipo** — distorsiona la percepción de área y ángulo. Siempre.
- **Pie con >6 rebanadas** — usa barras.
- **Doble eje Y sin etiquetado explícito** — permite "probar" cualquier correlación estirando escalas.
- **Área apilada con >4 series** — solo la serie de abajo es legible.

---

## FASE 5 — Jerarquía visual y layout

### 5.1 Sketch antes de construir

No abras la herramienta de BI todavía. Papel o wireframe primero: organiza la información, detecta KPIs faltantes, planea el orden de lectura, ahorra horas de rediseño.

### 5.2 El orden de lectura es el orden de la historia

Los ojos escanean en patrón F: arriba-izquierda → derecha → abajo. El layout debe coincidir con la jerarquía narrativa:

1. **Arriba: headline + KPIs** — resumen de desempeño. El "qué pasó" en 5 segundos.
2. **Medio: tendencia** — cómo cambia en el tiempo. El contexto.
3. **Abajo-medio: breakdowns** — qué está impulsando los números. El porqué.
4. **Fondo: detalle** — tabla para drill-down. La evidencia.

**Quick check:** si alguien ve el dashboard 5 segundos, ¿se lleva lo que más importa? Si no, la jerarquía está mal.

### 5.3 Atributos pre-atentivos: haz el insight imposible de ignorar

El cerebro detecta en milisegundos: **posición** (arriba-izquierda gana), **tamaño** (lo grande importa), **color** (uno distinto salta), **forma** (lo diferente resalta), **longitud** (barras más largas). Reglas:

- Un solo cue fuerte por insight. Dos o más compiten y se anulan.
- Contraste solo en lo que importa. Si todo resalta, nada resalta.
- Consistencia: el mismo cue visual significa lo mismo en todo el dashboard.

### 5.4 Color con intención

- El color **comunica, no decora.** Un color primario para lo que importa; el resto en neutros.
- Semántica fija: verde = bien/creciendo (cuando crecer es bueno), rojo = alerta/caída, ámbar = atención, gris = neutro/contexto. Máximo 4 colores semánticos.
- El significado depende de la dirección de bondad del KPI (Fase 2.5): un costo que sube va en rojo aunque la flecha apunte hacia arriba.
- Consistencia > variedad. El mismo color significa lo mismo en todas las vistas.

### 5.5 Números legibles

- **Redondea según la decisión, no según el dato.** El ejecutivo decide igual con "RM 2.8M" que con "RM 2,847,392.18". La precisión falsa es ruido (y si el sensor tiene ±2%, mostrar 87.3% es mentir con decimales).
- Unidades declaradas una vez por bloque, no repetidas en cada cifra.
- Deltas siempre con signo y base: "▲ 12% vs. mes anterior" — nunca "12%" solo.

---

## FASE 6 — La narrativa

### 6.1 Estructura de historia: contexto → conflicto → resolución

- **Contexto** — ¿qué está pasando? ("El tráfico subió 40%")
- **Conflicto** — ¿cuál es el problema u oportunidad? ("Pero la conversión quedó plana")
- **Resolución** — ¿qué hacemos? ("Mejorar landing y checkout")

La gente no recuerda "tráfico +40%". Recuerda "atraemos visitantes pero los perdemos antes de comprar". Las historias se recuerdan; las estadísticas no.

### 6.2 Headline primero

No hagas que la audiencia busque la respuesta. El dashboard abre con la conclusión: **"Revenue is up 12% this month ↗"** — y todo lo demás la sustenta o la explica.

### 6.3 El cierre obligatorio: insight → recomendación → impacto

Toda historia de datos termina en acción o no terminó:

- **Insight:** "El crecimiento viene de Producto A en la región Norte."
- **Recomendación:** "Aumentar inventario y marketing de Producto A en Norte."
- **Impacto esperado:** "Capturar la demanda y sostener el crecimiento."

### 6.4 Las 4 preguntas que un dashboard debe responder

1. **¿Qué pasó?** (KPIs y headline)
2. **¿Por qué pasó?** (breakdowns y drivers)
3. **¿Qué debemos hacer?** (recomendación explícita)
4. **¿Qué sigue?** (qué monitorear para validar la decisión)

Si la pantalla responde solo la 1, es un reporte disfrazado.

### 6.5 En vez de esto → muestra esto

- ❌ 20 KPIs en una pantalla, todos con el mismo peso.
- ✅ El insight que importa ("Conversión ↓12%"), su causa ("abandono de checkout móvil subió"), la recomendación ("simplificar checkout") y el impacto ("recuperar revenue perdido").

Regla de oro: **el objetivo del data storytelling no es explicar datos. Es ayudar a decidir mejor.**

---

## SECCIÓN 7 — Honestidad visual (no negociable)

Estas reglas protegen la confianza. Violarlas convierte el dashboard en propaganda:

1. **Eje Y arranca en cero** para valores absolutos y barras. Ejes de desviación se permiten solo etiquetados explícitamente.
2. **Sin doble eje Y** salvo etiquetado con contexto de escala en ambos lados.
3. **Escalas de tiempo uniformes** — no comprimir los meses malos.
4. **Sin cherry-picking de ventana temporal** — si eliges 6 meses en vez de 12, declara por qué.
5. **Denominadores visibles** — "80% de éxito" sobre n=5 no es lo mismo que sobre n=5,000.
6. **Precisión honesta** — decimales acordes a la precisión real de la medición.
7. **Comparaciones simétricas** — si muestras el mejor caso, el peor existe en el mismo chart o a un clic.
8. **El dato incómodo no se esconde** — si la historia real es mala, el dashboard la cuenta. Un dashboard que solo da buenas noticias es un riesgo de negocio (decisiones sobre "95% vs. target" que en realidad era 72%).

---

## SECCIÓN 8 — Cadencia, frescura e interactividad

### 8.1 Frescura del dato

- Todo panel con dato "vivo" declara su **última actualización** visible.
- La cadencia se define por la decisión, no por la tecnología: si la decisión es mensual, el dashboard en tiempo real es ruido caro.
- Dato stale sin indicador = dato falso para efectos prácticos.

### 8.2 ¿Interactivo o estático?

| Señal | Formato |
|---|---|
| La audiencia hará preguntas de seguimiento (¿y por región?, ¿y sin ese cliente?) | Interactivo con drill-down y filtros |
| La audiencia consume y decide (comité, board) | Estático con narrativa fija — el drill-down lo hiciste tú antes |
| El usuario explora patrones (analista) | Interactivo con filtros potentes y export |

Un filtro que nadie usa es deuda de mantenimiento. Empieza estático; agrega interactividad cuando una pregunta de seguimiento se repita 3 veces.

---

## SECCIÓN 9 — Escala: cuando hay demasiado que mostrar

Aplica cuando el dominio excede lo presentable: muchas unidades (sucursales, sitios, clientes) × muchos dominios (módulos, áreas, líneas) × muchos KPIs. El error típico es intentar mostrarlo todo; el resultado es un dashboard que nadie lee.

**Principio rector: nadie gestiona N unidades leyendo N unidades. Gestiona las que se desviaron.**

### 9.1 Diseño por excepción

- El estado sano es **invisible o colapsado**: "17 de 20 en rango" es una línea, no 17 filas.
- El dashboard abre con las desviaciones, ordenadas por severidad, cada una con link directo a su unidad/dominio.
- Métrica de éxito del diseño: en 5 segundos el usuario sabe **dónde** está el problema, aunque aún no sepa el detalle.

### 9.2 La matriz unidad × dominio (vista de red)

Para el nivel más agregado, la vista canónica es un **heatmap de semáforos**: filas = unidades, columnas = dominios. 20 × 5 = 100 celdas legibles en un vistazo; los patrones emergen solos ("columna Refrigeración en rojo en el cluster norte" = problema sistémico, no local).

- Cada celda es un estado agregado (verde/ámbar/rojo/gris), no un número.
- Orden default con intención: peor-primero, no alfabético.
- Cada celda es clickeable → drill al dominio de esa unidad.

### 9.3 Scores compuestos (con dos reglas duras)

Para rankear unidades se normalizan los KPIs de cada dominio en un health score. Condiciones no negociables:

1. **Receta explícita** — qué KPIs pesan cuánto, visible en el propio dashboard o a un clic. Un score opaco genera desconfianza y discusiones sobre el score en vez de sobre la operación.
2. **Drill-down siempre disponible** — un compuesto sin desglose esconde causas. El score dice *dónde* mirar, nunca sustituye el *porqué*.

### 9.4 Rankings y movers, no listas planas

Nadie lee N filas con igual atención; lee extremos y cambios:

- **Top / bottom 5** por score o por KPI crítico.
- **Movers** — mayores cambios vs. periodo anterior (una unidad estable en ámbar preocupa menos que una que cayó de verde a ámbar esta semana).

### 9.5 El drill path es la narrativa

A escala, la historia no cabe en una pantalla — cabe en una **navegación**. Cada nivel responde una pregunta:

| Nivel | Pregunta | Vista |
|---|---|---|
| Red | ¿Dónde está el problema? | Matriz unidad × dominio + excepciones |
| Unidad | ¿En qué dominio? | Scorecard de sus dominios + tendencias |
| Dominio | ¿Qué KPI lo causa? | KPIs del dominio con baselines |
| KPI | ¿Qué evidencia hay? | Detalle, series, tabla |

Regla: ningún nivel duplica el detalle del siguiente. Si la vista red muestra los KPIs individuales de cada unidad, el drill path no tiene razón de existir y la pantalla colapsa.

### 9.6 Una vista por rol, no una vista para todos

Mismo modelo de datos, recortes distintos: el ejecutivo ve la matriz de red; el gerente regional ve su cluster expandido; el responsable de unidad ve sus dominios a detalle. Intentar servir a los tres con una pantalla produce la peor pantalla para los tres.

### 9.7 Benchmark interno: la red como baseline

A escala multi-unidad, la comparación más diagnóstica no es contra la meta — es contra las demás unidades. La meta dice si llegaste a un número negociado; la red dice si tu problema es local o sistémico. **El cruce de ambas es el diagnóstico:**

| | **Bien vs. red** | **Mal vs. red** |
|---|---|---|
| **Bien vs. meta** | Sano | Meta floja — hay upside oculto |
| **Mal vs. meta** | Problema **sistémico** o meta mal calibrada | Problema **local** — actuar sobre la unidad |

El cuadrante "mal vs. meta / bien vs. red" evita el error más caro de la gestión multi-unidad: castigar a una unidad por un problema que es de todos (o de la meta).

**Cuatro reglas de diseño:**

1. **Mediana, no promedio.** Una unidad gigante arrastra el promedio; la mediana es robusta. Mejor aún: cuartiles — "cuartil inferior" comunica más que "4% bajo el promedio".
2. **Cohortes, no red completa.** Comparar la unidad chica rural contra la flagship urbana mide el segmento, no la gestión. Agrupar por tamaño/tipo/región y comparar dentro del cohorte. Sin esto, el ranking desmoraliza a quien pierde por estructura.
3. **Normalizar antes de comparar.** Los absolutos rankean tamaño; los ratios rankean desempeño: ventas/m², consumo/volumen, mermas/unidades. Comparar absolutos entre unidades de distinto tamaño es el error #1.
4. **El mejor interno es el benchmark más creíble.** "La unidad X logra esto con los mismos sistemas y recursos" es alcanzable por definición — nadie puede alegar "es que ellos son otra cosa".

**Dos riesgos a gestionar:**

- **Goodhart.** Si el ranking es público y va amarrado a incentivos, la gente optimiza el número, no la operación. El ranking informa gestión; no es compensación automática.
- **Ruido de posición.** Moverse del lugar 8 al 11 dentro de la banda de ruido no es señal. Mostrar bandas/cuartiles, no posiciones exactas; alertar por cambio de banda, no de lugar.

**En el dashboard:** el KPI card gana un segundo delta ("▲ 4% vs. meta · ▼ 8% vs. mediana cohorte") y la vista de red gana un box plot de la distribución con "tú estás aquí".

---

## SECCIÓN 10 — Ciclo de vida y auditoría del dashboard

Los dashboards acumulan grasa: cada "agrégame esto" suma un elemento y nadie resta ninguno. Sin ciclo de vida, todo dashboard converge al anti-patrón de los 20 KPIs con igual peso. Esta sección es una **auditoría periódica** (semestral recomendada), no una regla de diseño.

### 10.1 Las cuatro preguntas de auditoría por KPI

1. **¿Cambió alguna decisión?** ¿Alguien actuó distinto por este número en los últimos 2–3 ciclos? Si nadie puede citar una decisión, es candidato a retiro.
2. **¿Alguien lo consulta?** Analytics de uso del propio dashboard: vistas, filtros usados, drill-downs. Un panel sin visitas es un panel muerto.
3. **¿Sigue teniendo dueño?** Si la persona que lo pidió ya no está o el proceso cambió, el KPI está huérfano.
4. **¿La definición sigue vigente?** Cambios de proceso, de módulo o de negocio pueden dejar el cálculo desactualizado sin que nadie lo note (el dato "funciona", pero mide otra cosa).

### 10.2 Destinos posibles (no solo borrar)

- **Retirar** — falló las 4 preguntas.
- **Degradar** — sale de la pantalla principal, vive en drill-down o en reporte bajo demanda.
- **Fusionar** — dos KPIs que siempre se leen juntos se vuelven uno compuesto.
- **Promover** — el caso inverso: algo enterrado en detalle que resultó decisor sube de nivel.

### 10.3 Señales de dashboard muerto

- Dato stale y **nadie se quejó** — la señal más fuerte: si nadie notó que dejó de actualizarse, nadie lo usa.
- Los mismos filtros default desde hace meses.
- El dueño no sabe responder "¿qué decisión se toma con esto?".

Regla de higiene: **todo elemento nuevo entra con fecha de revisión.** "Lo agregamos para el issue de Q3" implica que en Q1 siguiente se pregunta si sigue ganándose su lugar en pantalla.

---

## SECCIÓN 11 — Checklist pre-flight

Obligatorio en modo **Diseñar** (correr antes de entregar) y herramienta de diagnóstico en modo **Revisar**. Si un ítem falla, no está terminado — o se declara conscientemente por qué se omite.

**Bloque A — Fundamento**
- [ ] Audiencia nombrada y decisión que tomará identificada
- [ ] Preguntas de negocio explícitas (no "dashboard de X")
- [ ] Cada KPI tiene: definición única, dueño, baseline, umbral, dirección de bondad

**Bloque B — Insight**
- [ ] Hay un insight central (no solo datos ordenados)
- [ ] El insight sobrevivió al "¿cuáles son todas las causas posibles?"
- [ ] Hecho y supuesto están diferenciados

**Bloque C — Gráficas**
- [ ] Cada gráfica responde a una pregunta nombrable
- [ ] Tipo de gráfica correcto según tabla de decisión (Fase 4.1)
- [ ] Cero anti-charts (gauge, 3D, pie>6, doble eje sin etiquetar)
- [ ] Máximo 5 series por gráfica; el resto agrupado en "Otros"

**Bloque D — Jerarquía**
- [ ] Headline arriba-izquierda; orden KPIs → tendencia → breakdown → detalle
- [ ] Un solo cue visual fuerte por insight
- [ ] Máximo 4 colores semánticos, con significado consistente
- [ ] Test de 5 segundos: lo más importante se ve primero

**Bloque E — Narrativa**
- [ ] Responde las 4 preguntas (qué/por qué/qué hacer/qué sigue)
- [ ] Cierra con recomendación + impacto esperado
- [ ] Los números tienen baseline visible ("vs. qué")

**Bloque F — Honestidad**
- [ ] Ejes en cero (o desviación declarada), escalas uniformes, denominadores visibles
- [ ] Frescura del dato declarada
- [ ] La historia mala, si existe, está contada

**Bloque G — Escala (solo multi-unidad × multi-dominio)**
- [ ] Diseño por excepción: el estado sano está colapsado, las desviaciones abren la vista
- [ ] Vista de red = matriz unidad × dominio con semáforos, orden peor-primero
- [ ] Scores compuestos con receta explícita y drill-down disponible
- [ ] Drill path definido: cada nivel responde una pregunta y no duplica el siguiente
- [ ] Una vista por rol (no una pantalla para todos)
- [ ] Benchmark interno: KPIs comparados vs. mediana del cohorte (normalizado por ratio, no absolutos)
- [ ] El cruce meta × red permite distinguir problema local de sistémico

**Bloque H — Auditoría periódica (semestral, sobre dashboards vivos)**
- [ ] Cada KPI pasó las 4 preguntas (decisión / uso / dueño / definición vigente)
- [ ] Elementos que fallaron tienen destino asignado: retirar, degradar, fusionar o promover
- [ ] Todo elemento nuevo entró con fecha de revisión
- [ ] No hay dato stale que nadie haya reportado (señal de panel muerto)

---

## REGLAS DE APLICACIÓN

1. **Alcance del skill.** Este skill decide *qué* mostrar y *qué historia* cuenta: KPIs, baselines, gráficas, jerarquía narrativa, escala y auditoría. No impone sistema visual: los tokens, componentes y marca del equipo se aplican encima sin conflicto. Si el proyecto tiene su propio design system o guía de marca, respetarlo para el *cómo se ve*.

2. **La honestidad visual (Sección 7) no es negociable.** Ninguna instrucción del usuario ("hazlo ver mejor para el board") suspende esas reglas. Si el usuario pide un recorte que maquilla la historia, nombrar la regla y ofrecer la alternativa honesta.

3. **En modo Revisar, diagnosticar contra el checklist, no contra el gusto.** Cada falla se reporta con su bloque (A–H) y su fix anclado en la fase correspondiente. Opinión sin ítem del checklist no es diagnóstico.

4. **Proporcionalidad.** Pregunta puntual → respuesta puntual con referencia a la fase. El pipeline completo se despliega solo en modo Diseñar o cuando el usuario lo pide.

5. **Fuera de alcance deliberado:** modelos de ML y capas de IA generativa (otra disciplina), gobernanza de datos como práctica (solo se exige como prerequisito en Fase 2.1), y herramientas específicas de BI.
