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
- **Branch protection en `main`** *(Scorecard, 0/10)* — exigir PRs con
  revisión chocaría con la forma de trabajar actual (directo en `main`,
  preguntar antes de cada push). Necesita que Mikel decida el trade-off,
  no es una config que se activa sola.
- **CII Best Practices badge** *(Scorecard, 0/10)* — cuestionario de
  autoevaluación en bestpractices.dev, no una config de repo. Más esfuerzo
  que los otros checks de Scorecard, aparcado por ahora.
- **CodeQL / SAST** *(Scorecard, 0/10)* — no se llegó a añadir el
  2026-07-22 junto al resto de hardening; añadir un workflow estándar de
  GitHub es barato, pero puede sacar hallazgos propios que haya que
  triar, a diferencia de los cambios de config de esa sesión.
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
15. ✅ **OpenSSF Scorecard y provenance/SBOM en la imagen Docker**
    *(2026-07-22)* — workflow de Scorecard (badge en el README, corre en
    cada push a main y semanalmente) y `sbom: true` en `release-image.yml`.
    La provenance de la imagen resultó ya estar puesta sola: `docker/
    build-push-action` la genera por defecto al publicar en un registro
    público (verificado con `docker buildx imagetools inspect` sobre la
    0.7.0 ya publicada — SLSA provenance real de BuildKit, con el builder
    apuntando al run de GitHub Actions). Solo el SBOM faltaba pedirlo.

    **Primer informe real (2026-07-22): 3.3/10.** La mayoría de lo bajo es
    estructural (proyecto <90 días, sin PRs externos, un solo mantenedor —
    no arreglable hoy) o pide una decisión aparte (Branch-Protection choca
    con trabajar directo en `main`; CII-Best-Practices es un cuestionario
    de autoevaluación, no una config). Lo accionable, hecho el mismo día:
    - Dos vulnerabilidades transitivas reales de la fecha (`fast-uri`
      confusión de host, `@hono/node-server` path traversal en
      serve-static), ambas via `@modelcontextprotocol/sdk`. Investigadas a
      fondo antes de tocar nada: la de `@hono/node-server` no era
      explotable en nuestro caso (el SDK solo usa `getRequestListener`,
      nunca `serve-static`), pero se corrigió igual con un override de
      pnpm — verificado que la firma de la función es idéntica entre
      1.19.14 y 2.0.10 antes de forzar el salto de major. La de `fast-uri`
      sí aplicaba de verdad. Ambas con override + E2E real (cliente MCP
      conectando contra el server con las versiones forzadas).
    - `SECURITY.md`/`SECURITY.es.md` + private vulnerability reporting de
      GitHub activado (ajuste de API, no de código).
    - `.github/dependabot.yml` (npm del workspace pnpm entero, github-actions,
      docker).
    - Permisos mínimos explícitos en `ci.yml` (le faltaban; los otros dos
      workflows ya los tenían desde que se escribieron).
    - Los tres workflows y el `FROM` del Dockerfile pineados por SHA/digest
      en vez de por tag flotante — viable sin perder actualizaciones porque
      Dependabot ya sabe mantener pines al día.

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
