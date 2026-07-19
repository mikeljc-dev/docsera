# Deuda técnica y mejoras pendientes (2026-07-19)

Lista salida de revisar el repo tras publicar la v0.3.0. A diferencia de
`fase-3-ideas.md` —que es producto y análisis de competencia— esto es lo que
hay que arreglar dentro. Ordenado por lo que conviene hacer antes.

## 1. Ningún test toca HTTP — ✅ en marcha (2026-07-19)

**Hecho.** Costuras `setPool()` (`lib/db.ts`) y `setChatAdapter()` /
`setEmbeddingsAdapter()` (`llm/index.ts`), más dobles compartidos en
`testing/doubles.ts` (pool falso que responde por regex sobre el SQL,
adaptadores falsos, y un `fakeConnEnv` porque `getConnInfo()` revienta sin
socket). Con eso, las rutas se ejercen con `route.fetch(new Request(...))`,
sin Postgres ni Docker.

Cubierto ya (78 tests, +11):
- `POST /chat/stream`: orden `delta`* → `done`; el `done` con
  `sources`/`conversationId`/`answered`/`sessionId`; el centinela nunca sale
  por un `delta` y suprime fuentes; sin cobertura no se llama al LLM;
  proveedor sin `chatStream`; el fallo del proveedor sale como evento `error`
  **sin filtrar el mensaje interno**; body inválido → 400 JSON; `sessionId`
  con formato inválido descartado.
- Rate limit → 429 sin llegar al LLM (en `chatStreamRateLimit.test.ts`
  aparte: el limitador es un singleton perezoso y `tsx --test` da un proceso
  por fichero, que es la única forma limpia de fijar `CHAT_RATE_LIMIT` antes
  de la primera petición).
- `GET /llms.txt`: `text/plain`, H1, páginas, y `https` con
  `x-forwarded-proto`.

Verificado que no son decorativos: con `HOLD_CHARS = 0` caen 6 tests,
incluido el de ruta.

**Queda pendiente:** `POST /ingest` (401 sin token), `POST /chat` (el JSON
clásico, aún sin cubrir) y `POST /mcp`. Y por encima de todo, **el SQL sigue
sin probarse**: el pool falso no valida las consultas. Un Postgres con
pgvector como service de GitHub Actions daría tests de integración de verdad
—migraciones, `tsv`, distancias— y es el siguiente escalón natural.

### Enunciado original

**Qué pasa.** Los 67 tests son de funciones puras (`fuseRankings`,
`buildChatMessages`, `streamAnswer`, `assessConfidence`, chunking, rate
limit…). No hay un solo test que haga una petición: ni a `/chat`, ni a
`/chat/stream`, ni a `/ingest`, ni a `/mcp`, ni a `/llms.txt`.

**Por qué importa.** Todo lo entregado el 2026-07-19 (streaming, multi-turno,
llms.txt) está verificado **solo porque se ejerció a mano con curl y
Playwright**. Cuando alguien toque `routes/`, CI dará verde sin haber probado
una petición. Y con el lanzamiento en HN van a llegar PRs de gente que no
conoce el proyecto.

**Qué falta cubrir, en concreto:**
- `POST /chat/stream`: orden de eventos (`delta`* → `done`), que el `done`
  trae `sources`/`conversationId`/`answered`, y que el centinela nunca sale
  por un `delta`.
- Body inválido → 400 con `details`; sin `question` → 400.
- Rate limit → 429 (el limiter ya es testeable en aislado, falta el 429 real).
- `GET /llms.txt` → `content-type: text/plain`, H1 y esquema `https` con
  `x-forwarded-proto`.
- `POST /ingest` sin token → 401.

**Cómo.** Hono expone `app.fetch(new Request(...))`: se testea sin levantar
servidor ni Docker. Hace falta poder inyectar/simular el pool de Postgres y
los adaptadores de LLM, que hoy se obtienen con `getPool()` y
`getChatAdapter()` — probablemente sea el trabajo de verdad de este punto.

**Esfuerzo:** medio. **Es el mayor agujero del proyecto ahora mismo.**

## 2. `packages/server` no se construye — ✅ hecho (2026-07-19)

`"build": "echo \"TODO: build del server\""` en su `package.json`. CI corre
`pnpm build` y pasa sin compilar el paquete más importante; en producción lo
transpila `tsx` en runtime. Funciona, pero la fase de build de CI es
decorativa justo donde más haría falta. Compilar de verdad (tsc o esbuild)
también quitaría `tsx` del arranque en producción.

**Hecho.** `build` pasa a `tsc -p tsconfig.build.json` + copia de los `.sql`
de migraciones (que `tsc` no arrastra). `tsconfig.build.json` excluye tests y
`src/testing`, que sí deben pasar por el typecheck pero no viajar en el
artefacto. El `Dockerfile` compila y arranca con `node dist/...` en vez de
`tsx src/...`: TypeScript sale de la ruta crítica de producción y un error de
tipos aparece al construir, no al arrancar.

Verificado construyendo la imagen real y arrancándola contra el Postgres
local: migraciones aplicadas desde `dist`, `/health`, `/chat` con citas,
`/llms.txt` y `widget.js` respondiendo, y **cero procesos `tsx`** dentro del
contenedor.

**Queda pendiente:** la imagen sigue instalando devDependencies (470 MB). Un
`pnpm install --prod` en una segunda etapa, o un multi-stage, la bajaría
bastante. No es urgente.

## 3. Enlaces Markdown sin renderizar en el widget — ✅ hecho (2026-07-19)

El system prompt le prohíbe enlaces al modelo, pero los emite igual: en la
burbuja se ve `[AGPL-3.0](./LICENSE)` en crudo (visible en las capturas del
2026-07-19). Dos salidas: renderizarlos en `markdown.ts` (solo `http(s)`,
con `rel="noopener noreferrer"` y `target="_blank"`, manteniendo el criterio
XSS-safe actual de no usar `innerHTML`), o quitarles la sintaxis al vuelo y
dejar solo el texto.

**Por qué importa.** Es lo más feo que ve alguien que aterrice en la demo
desde Hacker News.

**Hecho.** `markdown.ts` renderiza `[texto](url)` como `<a>` con
`target="_blank"` y `rel="noopener noreferrer"`. Solo destinos **http(s)
absolutos**: Lit interpola el href como texto pero no valida el esquema, así
que un `javascript:` seguiría siendo ejecutable; y un relativo como
`./LICENSE` —que el modelo emite a menudo, porque la doc vive en un repo—
apuntaría a la web anfitriona. En ambos casos se conserva el texto y se tira
el destino. El patrón admite un nivel de paréntesis anidados, si no las URL
de Wikipedia (`..._(bar)`) se cortaban y dejaban un `)` suelto.

Verificado en Chromium contra un servidor falso que devuelve a propósito
`javascript:`, `data:text/html,<script>`, un relativo y una URL con
paréntesis: solo se convierten en enlace los dos legítimos, no salta ningún
diálogo y no queda sintaxis cruda.

**Nota:** el widget **no tiene tests**. `markdown.ts` es puro y merecería los
suyos, pero el paquete no tiene ni script de `test`; `renderMarkdown` además
devuelve plantillas de Lit, así que haría falta renderizarlas para
comprobarlas. Esta verificación fue con Playwright, a mano. Es deuda nueva,
hermana del punto 1.

## 4. La versión, a mano en tres sitios

`index.ts` lee la versión del `package.json`, pero estos no:

- `ingest/fetchSource.ts` → `USER_AGENT = "DocseraBot/0.3.0"`
- `routes/mcp.ts` → `{ name: "docsera", version: "0.3.0" }`
- `packages/docs/index.html` → badge `v0.3.0` y el ejemplo de `/health`

En la release v0.3.0 ya se olvidó actualizar los README (se detectó y corrigió
después). Volverá a pasar. Los dos del server pueden leer el `package.json`
como hace `index.ts`; el de las docs necesita inyectarlo en build con Vite.

**Esfuerzo:** bajo.

## 5. Una respuesta mala envenena el turno siguiente

`loadRecentTurns` mete en el historial la respuesta anterior tal cual, sin
mirar si fue buena. Observado en vivo el 2026-07-19: tras una respuesta
desviada, la reescritura del siguiente seguimiento heredó el tema equivocado
y se alejó aún más.

**Arreglo:** excluir del historial los turnos con `answered = false` (y quizá
los que tengan 👎 en `feedback`). Son tres líneas en el `WHERE` de
`chat/history.ts`.

**Esfuerzo:** bajo. Ojo: hay que decidir si un turno excluido rompe la
continuidad de la conversación o simplemente se salta.

## 6. Streaming a trompicones según el proveedor

Gemini (lo que corre en la demo pública) manda fragmentos enormes: una
respuesta entera puede llegar en dos `delta`. El efecto de escritura no se
aprecia. No es un bug —los fragmentos se emiten según llegan— sino cómo
trocea el proveedor. Si se quiere suavizar, hay que trocear en el cliente
antes de pintar.

**Esfuerzo:** bajo. **Solo afecta a la demo pública**, no a quien se lo
instale con Anthropic, OpenAI u Ollama.

## 7. Los watch paths de Railway dejaban fuera al widget

**Encontrado el 2026-07-19.** El commit `91a6345` (enlaces Markdown del
widget) pasó CI y llegó a `main`, pero Railway no lo desplegó: el filtro de
rutas configurado en su UI solo miraba `packages/server/**`. Como el server
sirve el bundle del widget y el build del dashboard desde su propia imagen,
**cualquier cambio solo-widget o solo-dashboard nunca llegaba a producción**,
en silencio y con todo en verde.

**Arreglado** declarando `build.watchPatterns` en `railway.json`, versionado,
en vez de depender de la configuración de la UI. Queda pendiente que Mikel
confirme que el filtro de la UI no lo pisa (Settings → Source → Watch Paths):
si lo hace, hay que vaciarlo allí.

**Lección:** cualquier configuración de despliegue que viva solo en un panel
web es invisible desde el repo y no se puede revisar en un PR.

## Lo que NO está en esta lista

- **Señal de confianza (punto 8 de `fase-3-ideas.md`)**: implementada y
  revertida con datos. No es deuda, es una idea descartada por ahora.
- **Conectores PDF / bot de Discord**: producto, no deuda. Están en
  `fase-3-ideas.md`.
