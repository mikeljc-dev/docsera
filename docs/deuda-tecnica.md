# Deuda técnica y mejoras pendientes (2026-07-19)

Lista salida de revisar el repo tras publicar la v0.3.0. A diferencia de
`fase-3-ideas.md` —que es producto y análisis de competencia— esto es lo que
hay que arreglar dentro. Ordenado por lo que conviene hacer antes.

## 1. Ningún test toca HTTP

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

## 2. `packages/server` no se construye

`"build": "echo \"TODO: build del server\""` en su `package.json`. CI corre
`pnpm build` y pasa sin compilar el paquete más importante; en producción lo
transpila `tsx` en runtime. Funciona, pero la fase de build de CI es
decorativa justo donde más haría falta. Compilar de verdad (tsc o esbuild)
también quitaría `tsx` del arranque en producción.

**Esfuerzo:** bajo-medio.

## 3. Enlaces Markdown sin renderizar en el widget

El system prompt le prohíbe enlaces al modelo, pero los emite igual: en la
burbuja se ve `[AGPL-3.0](./LICENSE)` en crudo (visible en las capturas del
2026-07-19). Dos salidas: renderizarlos en `markdown.ts` (solo `http(s)`,
con `rel="noopener noreferrer"` y `target="_blank"`, manteniendo el criterio
XSS-safe actual de no usar `innerHTML`), o quitarles la sintaxis al vuelo y
dejar solo el texto.

**Por qué importa.** Es lo más feo que ve alguien que aterrice en la demo
desde Hacker News.

**Esfuerzo:** bajo.

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

## Lo que NO está en esta lista

- **Señal de confianza (punto 8 de `fase-3-ideas.md`)**: implementada y
  revertida con datos. No es deuda, es una idea descartada por ahora.
- **Conectores PDF / bot de Discord**: producto, no deuda. Están en
  `fase-3-ideas.md`.
