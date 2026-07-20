# Roadmap de producto — Fase 3

Nació como análisis de la competencia (Intercom Fin, Mintlify, DocsBot,
kapa.ai) el 2026-07-17: qué tienen ellos que Docsera podía implementar,
ordenado por impacto/esfuerzo. Repasado y limpiado el 2026-07-20 — 12 de
las 14 ideas originales están hechas, así que este documento pasa de
"análisis" a "roadmap vivo": lo hecho queda en una línea (el detalle de
diseño vive en `ARCHITECTURE.md`, las notas de sesión en `CLAUDE.md`, y el
porqué de cada decisión en los mensajes de commit), y lo que sigue abierto
queda arriba, no enterrado entre párrafos.

## Próximos candidatos

Nada aquí está priorizado sobre lo demás; son las puertas abiertas que se
identificaron trabajando en otras cosas, no una cola.

- **Conectores Notion/Confluence** *(DocsBot, kapa)* — necesitan OAuth, más
  esfuerzo de integración que PDF/GitHub. Aparcados hasta que alguien los
  pida explícitamente.
- **Re-ranking con cross-encoder** — la búsqueda híbrida (RRF) fusiona vector
  + full-text pero no re-ordena el top-k con un modelo dedicado. Anotado
  como pendiente desde que se implementó la búsqueda híbrida (2026-07-18).
- **Mitigar respuestas desviadas con `answered=true`** — el historial ya
  descarta los turnos sin respuesta, pero una respuesta *mal enfocada* que
  cuenta como respondida sigue contaminando la reescritura del siguiente
  turno. Sin arreglo barato encontrado (ver `docs/deuda-tecnica.md` punto
  5); necesita preguntas reales de usuarios para calibrar algo mejor, no
  cuatro ejemplos de prueba.
- **Retomar la señal de confianza vía marcador del LLM** — la vía por
  distancia coseno está descartada con datos (ver más abajo); la
  alternativa (pedirle un marcador `PARTIAL`/`NO_ANSWER` al propio LLM,
  coste cero en la misma llamada) apuntaba bien pero necesita el mismo tipo
  de calibración con tráfico real que el punto anterior.
- **OpenSSF Scorecard** — badge y workflow automático (GitHub Action, sin
  tocar código) que audita prácticas de seguridad del repo. Salió al
  comparar badges de otros proyectos (2026-07-20); no llegamos a añadirlo,
  a diferencia de License/Release/Tests que sí se añadieron esa sesión.
- **Provenance/SBOM en la imagen Docker** — el paquete npm ya lleva
  provenance (trusted publishing, SLSA attestations verificadas); la imagen
  de `ghcr.io/mikeljc-dev/docsera` todavía no genera las suyas
  (`docker/build-push-action` lo soporta con `provenance: true`).
- **Infra:** decidir plan de Railway cuando se agote el crédito del trial
  (Hobby ~5 $/mes, o migrar a Cloud Run + Neon con la misma imagen).

Fuera del alcance de este documento (es producto/análisis de competencia,
no el plan de fases): la **Fase 3 "cloud"** del plan original —versión
multi-tenant, billing con Stripe, free tier simbólico— sigue sin empezar.
Todo lo listado aquí y lo ya hecho ha sido pulir el producto self-hosted;
el salto a SaaS es una decisión de arquitectura mayor que merece su propia
conversación, no una entrada más en esta lista.

## Aparcado a propósito (no reabrir sin una razón nueva)

- **#8 — Señal de confianza por distancia coseno.** Implementada y
  revertida el 2026-07-19: medida contra la doc real, la distancia no
  separa "respondible" de "no respondible" ("Kubernetes ingress
  controller", no documentado, daba mejor distancia que una pregunta sí
  documentada). Con el umbral puesto, una respuesta inventada salía
  marcada como confianza *alta* — peor que no tener señal. La vía
  alternativa está en "Próximos candidatos".
- **#14 — Targeting por audiencia y acciones multi-paso** *(Fin
  "Procedures")* — para muy tarde; ahí Intercom lleva años de ventaja.

## Hecho

1. ✅ Feedback 👍/👎 en cada respuesta.
2. ✅ Markdown renderizado y código copiable en el widget.
3. ✅ Botón de escape a humano (`data-contact`).
4. ✅ Preguntas sugeridas al abrir el chat (`data-suggestions`).
5. ✅ Ingesta de repos de GitHub (`type: "github"`).
6. ✅ Analíticas de cobertura en el dashboard.
6b. ✅ Búsqueda híbrida full-text + vector con Reciprocal Rank Fusion.
7. ✅ Multi-turno con refinado de pregunta antes de embeber.
9. ✅ Streaming de respuestas (`POST /chat/stream`, SSE).
10. ✅ Conector PDF (`type: "pdf"`, una sección por página, sin OCR).
11. ✅ Bots de Discord y Slack sobre la misma API (`/ask`, sin gateway).
12. ✅ Servidor MCP (`POST /mcp`) y `GET /llms.txt`.
13. ✅ Redacción de secretos en la ingesta (`redactSecrets`, opt-in por
    petición, no global).

## Lectura estratégica

No competir en número de conectores (llevan años y equipos). Competir
donde ser open source y self-hosted da ventaja: feedback + analíticas de
cobertura, MCP/llms.txt, y los bots de comunidad (Discord/Slack) — las
tres áreas de la lista original ya están cubiertas.

## Referencias

- DocsBot: https://docsbot.ai/ · https://docsbot.ai/pricing
- kapa.ai: https://www.kapa.ai/ ·
  https://www.kapa.ai/product/answering-engine ·
  https://www.kapa.ai/blog/building-your-knowledge-base-with-kapa-insights
- Mintlify: https://www.mintlify.com/docs/ai-native ·
  https://www.mintlify.com/blog/introducing-ai-assistant-2025
- Intercom Fin:
  https://www.intercom.com/help/en/articles/7120684-fin-ai-agent-explained
