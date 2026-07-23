# Deuda técnica y mejoras pendientes (2026-07-19)

Lista salida de revisar el repo tras publicar la v0.3.0. A diferencia de
`roadmap-producto.md` —que es producto y análisis de competencia— esto es lo que
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

**Tests de integración con Postgres real — hecho (2026-07-19).** CI levanta
un service `pgvector/pgvector:pg16` y define `TEST_DATABASE_URL`; los
`*.integration.test.ts` aplican las migraciones de verdad y ejercen el SQL:
las dos ramas de la búsqueda híbrida, el umbral de distancia, la columna
`tsv` generada, el deduplicado del RRF, y el historial (filtro `answered`,
ventana de 30 min, límite de 3 turnos, aislamiento entre sesiones). 90 tests
en el server.

Dos decisiones del arnés (`testing/db.ts`):
- **Un esquema Postgres por fichero de test.** node:test corre los ficheros
  en paralelo; compartir tablas significaba que el `TRUNCATE` de uno borraba
  los fixtures de otro. Una carrera que solo habría aparecido en CI, de vez
  en cuando. `public` sigue en el `search_path` porque ahí vive el tipo
  `vector`.
- **La extensión `vector` se crea explícitamente en `public`**, antes de
  fijar el `search_path` del esquema. `CREATE EXTENSION IF NOT EXISTS vector`
  la instala en el *primer esquema del search_path*, así que cada fichero de
  test acababa con su propio tipo `vector` y el resto no lo veía. En local no
  se notó porque la BD de pruebas ya tenía la extensión en `public` de una
  ejecución anterior: **el fallo solo salió en CI, sobre una BD virgen**.
  Lección: probar los tests de integración contra una base de datos recién
  creada, no contra la que llevas usando toda la tarde.
- **Se saltan sin `TEST_DATABASE_URL`**, así que un `pnpm test` en local sin
  Postgres sigue pasando (avisa: `skipped 12`). En CI la variable está
  siempre, así que allí no se saltan nunca.

`migrate.ts` se partió en dos: la lógica reutilizable vive en
`db/migrations.ts` (`applyMigrations`) y el fichero original queda como CLI.

**Rutas restantes — hecho (2026-07-19).** `/ingest` (401 sin token, con token
erróneo, y **500 si no hay `ADMIN_TOKEN`: mal configurado se cierra, no se
abre**), `/chat` (la forma exacta del contrato JSON, que consumen el MCP y las
integraciones ajenas; no-respuesta sin fuentes; 500 sin filtrar el detalle) y
`/mcp` (las dos tools, `search_docs` sin llamar al LLM, 405 en GET/DELETE).

`/mcp` necesitó levantar un **servidor real** en un puerto libre: su transporte
escribe sobre el `req`/`res` crudos de Node y devuelve `RESPONSE_ALREADY_SENT`,
así que `route.fetch()` con un env falso no vale.

De `markdown.ts` se cubre `safeHref`, que es lo que de verdad importa ahí: la
frontera de seguridad. Renderizar las plantillas de Lit sigue sin cubrirse y
requeriría Lit SSR (dependencia nueva); el resto del renderizador se verifica
en navegador con Playwright.

**Total: 117 tests** (107 server + 10 widget).

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

## 4. La versión, a mano en tres sitios — ✅ hecho (2026-07-19)

`index.ts` lee la versión del `package.json`, pero estos no:

- `ingest/fetchSource.ts` → `USER_AGENT = "DocseraBot/0.3.0"`
- `routes/mcp.ts` → `{ name: "docsera", version: "0.3.0" }`
- `packages/docs/index.html` → badge `v0.3.0` y el ejemplo de `/health`

En la release v0.3.0 ya se olvidó actualizar los README (se detectó y corrigió
después). Volverá a pasar. Los dos del server pueden leer el `package.json`
como hace `index.ts`; el de las docs necesita inyectarlo en build con Vite.

**Hecho.** Nuevo `src/version.ts` como única fuente en el server (vale igual
desde `src/` con tsx que desde `dist/` en producción), usado por `/health`, el
User-Agent de la ingesta y el nombre del server MCP. En las docs, un plugin de
Vite sustituye `__DOCSERA_VERSION__` leyendo el `package.json` de la raíz.
Verificado con el server compilado: `/health` y el `serverInfo` del MCP
reportan la versión real. Ya no queda ningún `0.3.0` escrito a mano.

## 5. Una respuesta mala envenena el turno siguiente — ✅ parcial (2026-07-19)

`loadRecentTurns` mete en el historial la respuesta anterior tal cual, sin
mirar si fue buena. Observado en vivo el 2026-07-19: tras una respuesta
desviada, la reescritura del siguiente seguimiento heredó el tema equivocado
y se alejó aún más.

**Arreglo:** excluir del historial los turnos con `answered = false` (y quizá
los que tengan 👎 en `feedback`). Son tres líneas en el `WHERE` de
`chat/history.ts`.

**Hecho, con matices.** `loadRecentTurns` filtra ahora por `answered = true`.
Los turnos sin respuesta **se saltan, no cortan** la conversación: los
anteriores siguen dando contexto. Medido — con un turno sobre precios sin
responder de por medio, "¿cómo lo configuro?" se reescribía como "¿Cómo se
configura **la suscripción** de Docsera...?"; sin él, "¿Cómo configurar
Docsera para que soporte Ollama?".

**Lo que NO arregla, y conviene saberlo:** el caso que originó este punto era
una respuesta con `answered = true` pero desviada, así que este filtro no la
toca. Probé también quitar las respuestas del prompt de reescritura (dejando
solo las preguntas) y **empeora**: pierde el referente. Con
`[Ollama?] → [¿cómo lo configuro?]`, con respuestas mantiene "Ollama" y sin
ellas lo pierde. Descartado. No hay arreglo barato para el caso general;
convivir con ello hasta tener datos reales.

## 6. Streaming a trompicones según el proveedor — ✅ hecho (2026-07-19)

Gemini (lo que corre en la demo pública) manda fragmentos enormes: una
respuesta entera puede llegar en dos `delta`. El efecto de escritura no se
aprecia. No es un bug —los fragmentos se emiten según llegan— sino cómo
trocea el proveedor. Si se quiere suavizar, hay que trocear en el cliente
antes de pintar.

**Hecho.** `smooth()` en `widget/src/sse.ts` reparte cada fragmento a lo
largo de varios frames. Drena **proporcionalmente** a lo pendiente, así que
nunca se queda por detrás del stream (20 000 caracteres se agotan en decenas
de frames, no en miles), y con fragmentos ya pequeños —Ollama, Anthropic— no
cambia nada. Verificado en Chromium contra un servidor falso que imita a
Gemini mandando la respuesta en 2 deltas: la burbuja pasa de crecer en 2
saltos a hacerlo en 11.

**De paso, el widget ya tiene tests.** Tenía cero y ni script de `test`;
ahora corre `tsx --test` como el server. `smooth()` acepta el planificador de
frames por parámetro justo para poder probarlo sin `requestAnimationFrame`.
Cubre que no pierde ni reordena una letra, que respeta saltos de línea y
espacios del Markdown, y que drena rápido. Sigue faltando `markdown.ts`, que
necesita renderizar plantillas de Lit.

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

## 8. El glob de los tests dependía del shell

**Encontrado el 2026-07-19, en un CI rojo.** El script era
`tsx --test src/**/*.test.ts`. En zsh (mi local) `**` expande recursivamente;
en **bash sin `globstar` —lo que usa CI— `src/**/*.test.ts` equivale a
`src/*/*.test.ts`**, es decir, exige un subdirectorio. El primer test del
widget vivía en `src/sse.test.ts`, a un solo nivel, y CI no lo encontró.

Lo grave no es el fallo, es lo que escondía: **en el server llevaba desde
siempre igual y pasaba por casualidad**, porque todos sus tests están en
subcarpetas. Un `src/foo.test.ts` en la raíz se habría saltado en silencio,
con CI en verde.

**Arreglado** en ambos paquetes con `tsx --test $(find src -name '*.test.ts')`,
que no depende del shell. Verificado ejecutándolo con `bash` explícitamente,
no con el zsh del portátil.

**Lección:** comprobar los scripts de package.json con el mismo shell que CI.
Un verde local con otro shell no dice nada.

## Lo que NO está en esta lista

- **Señal de confianza (punto 8 de `roadmap-producto.md`)**: implementada y
  revertida con datos. No es deuda, es una idea descartada por ahora.
- **Conectores PDF / bot de Discord**: producto, no deuda. Están en
  `roadmap-producto.md`.
