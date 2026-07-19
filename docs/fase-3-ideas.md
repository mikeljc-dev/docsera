# Ideas para la Fase 3 — análisis de la competencia (2026-07-17)

Investigación sobre Intercom Fin, Mintlify, DocsBot y kapa.ai: qué tienen
ellos que Docsera puede implementar, ordenado por impacto/esfuerzo. Fuente:
webs y docs oficiales de cada producto a fecha del análisis.

## Quick wins (días, no semanas)

*(1-5 implementados: 1-4 el 2026-07-17, el 5 el 2026-07-18. Lista completa.)*

1. ✅ **Feedback 👍/👎 en cada respuesta** *(lo tienen todos)* — columna en
   `conversations`, dos botones en el widget, filtro en el dashboard. Base
   del "CSAT" y alimenta la detección de huecos de contenido.
2. ✅ **Markdown renderizado y código copiable en el widget** *(Mintlify)* —
   la burbuja hoy es texto plano; para docs técnicas, bloques de código
   copiables son oro. (En vez de prohibirle el Markdown al modelo,
   renderizarlo.)
3. ✅ **Botón de escape a humano** *(Fin)* — cuando responde "I don't know",
   ofrecer un enlace configurable (`data-contact` → mailto/URL de soporte).
   Convierte el fallo en derivación.
4. ✅ **Preguntas sugeridas al abrir el chat** *(DocsBot, kapa)* — chips
   configurables (`data-suggestions`) que eliminan la página en blanco.
5. ✅ **Ingesta de repos de GitHub** *(DocsBot, kapa)* — `type: "github"` que
   trae los `.md` de un repo público; el conector más barato de construir
   y el más pedido por audiencia developer.

## Medio plazo (corazón de la Fase 3)

6. ✅ **Analíticas de cobertura** *(2026-07-18)* *(kapa "coverage analytics", Mintlify
   "categories")* — top preguntas repetidas (clustering con los embeddings
   que ya tenemos), fuentes más citadas, tasa respondidas/no respondidas,
   CSAT del feedback. Con `conversations` + `conversation_sources` es
   mayormente SQL.
6b. ✅ **Búsqueda híbrida (full-text + vector, RRF)** *(2026-07-18)* — rama FTS
    de Postgres (`tsvector` 'simple' + `websearch_to_tsquery`) fusionada con
    la vectorial por Reciprocal Rank Fusion. Caza términos exactos (nombres de
    variables, códigos de error) donde el embedding flojea; sin dependencias
    ni servicios nuevos. Re-ranking con cross-encoder queda para después.
7. ✅ **Multi-turno con refinado de pregunta** *(2026-07-19)* *(Fin: refinar →
   recuperar → responder)* — se reescribe la pregunta con los 3 últimos turnos
   de la sesión (ventana de 30 min) antes de embeber, y los turnos previos van
   al prompt como mensajes reales. Coste: una llamada extra al LLM, solo en las
   preguntas de seguimiento.
8. ⚠️ **Señal de confianza** *(kapa)* — marcar respuestas cerca del umbral
   como "posiblemente incompleta" en vez del binario sé/no sé.
   **Implementado y revertido el 2026-07-19: por distancia NO funciona.**
   Medido contra la doc real (nomic-embed-text, 768d): "Kubernetes ingress
   controller" (no documentado) da 0.369, mejor que "ingest a GitHub repo"
   (documentado) con 0.436; "Stripe billing" (no documentado) 0.426. No hay
   umbral que separe respondible de no respondible: la distancia coseno mide
   parentesco temático, no cobertura. Con el umbral puesto, una respuesta
   inventada sobre Kubernetes salía marcada como confianza *alta* — peor que
   no tener señal.
   La vía que sí apunta bien es pedirle el marcador al propio LLM (coste
   cero, misma llamada): en la prueba, Stripe pasó a `NO_ANSWER` y Kubernetes
   a `PARTIAL`, pero `llama3.2` se pasó de prudente y marcó `PARTIAL` una
   pregunta sí documentada. Retomarlo tras el lanzamiento, detrás de un flag
   y calibrando con preguntas reales de usuarios, no con cuatro ejemplos.
9. ✅ **Streaming de respuestas** *(2026-07-19)* *(todos)* — `POST /chat/stream`
   por SSE (eventos `delta` + `done`), `chatStream` opcional en los tres
   adaptadores, y el widget rellenando la burbuja fragmento a fragmento. El
   centinela de no-respuesta se retiene los primeros 32 caracteres para que
   nunca se pinte a medias.
10. **Conectores PDF y Notion/Confluence** *(DocsBot 29+ fuentes, kapa
    30+)* — PDF primero (sin OAuth de por medio).

## Apuestas diferenciales (más esfuerzo, más titular)

11. **Bot de Slack/Discord sobre la misma API** *(kapa, DocsBot)* — mismo
    backend, otra superficie; Discord encaja con comunidades open source.
12. ✅ **Exponer las docs como servidor MCP** *(2026-07-18)* *(Mintlify)* —
    `POST /mcp` (Streamable HTTP, stateless) con tools `search_docs` (retrieval
    puro) y `ask_docs` (RAG con citas). "Tus docs, consumibles por agentes";
    encaja con nuestra audiencia developer. El `llms.txt` se añadió el 2026-07-19 (`GET /llms.txt`), generado desde
    los documentos indexados en vez de estático.
13. **PII masking en la ingesta** *(kapa)* — argumento enterprise que casa
    con el "privacy-first".
14. **Targeting por audiencia y acciones multi-paso** *(Fin
    "Procedures")* — para muy tarde; ahí llevan años de ventaja.

## Lectura estratégica

No competir en número de conectores (llevan años y equipos). Competir
donde ser open source y self-hosted da ventaja: feedback + analíticas de
cobertura (nuestro dashboard puede ser tan bueno como el suyo sin coste
por resolución), MCP/llms.txt, y el bot de Discord para comunidades OSS.
Los puntos 1-5 son abordables antes del primer feedback del lanzamiento.

## Referencias

- DocsBot: https://docsbot.ai/ · https://docsbot.ai/pricing
- kapa.ai: https://www.kapa.ai/ ·
  https://www.kapa.ai/product/answering-engine ·
  https://www.kapa.ai/blog/building-your-knowledge-base-with-kapa-insights
- Mintlify: https://www.mintlify.com/docs/ai-native ·
  https://www.mintlify.com/blog/introducing-ai-assistant-2025
- Intercom Fin:
  https://www.intercom.com/help/en/articles/7120684-fin-ai-agent-explained
