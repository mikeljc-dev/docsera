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

6. **Analíticas de cobertura** *(kapa "coverage analytics", Mintlify
   "categories")* — top preguntas repetidas (clustering con los embeddings
   que ya tenemos), fuentes más citadas, tasa respondidas/no respondidas,
   CSAT del feedback. Con `conversations` + `conversation_sources` es
   mayormente SQL.
7. **Multi-turno con refinado de pregunta** *(Fin: refinar → recuperar →
   responder)* — reescribir la pregunta con el historial antes de embeber.
8. **Señal de confianza** *(kapa)* — marcar respuestas cerca del umbral
   como "posiblemente incompleta" en vez del binario sé/no sé.
9. **Streaming de respuestas** *(todos)* — ya en roadmap.
10. **Conectores PDF y Notion/Confluence** *(DocsBot 29+ fuentes, kapa
    30+)* — PDF primero (sin OAuth de por medio).

## Apuestas diferenciales (más esfuerzo, más titular)

11. **Bot de Slack/Discord sobre la misma API** *(kapa, DocsBot)* — mismo
    backend, otra superficie; Discord encaja con comunidades open source.
12. **Exponer las docs como servidor MCP / `llms.txt`** *(Mintlify)* —
    "tus docs, consumibles por agentes"; encaja con nuestra audiencia.
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
