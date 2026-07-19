---
name: docsera-standards
description: Estándares mínimos de calidad para cualquier código, migración, doc o commit que se genere en el repo Docsera. Úsala ANTES de escribir o modificar código en este monorepo (server, widget, dashboard, web, docs) y antes de dar por terminada una tarea. Cubre convenciones TS/ESM, reglas por paquete, la puerta de calidad (typecheck/lint/test + verificación real) y las reglas de producto no negociables (citas, "no lo sé", privacy, secretos).
---

# Estándares de Docsera

Esto es el mínimo exigible a lo que generes en este repo. No es una guía de
estilo opcional: si algo de aquí no se cumple, la tarea **no está terminada**.

## 0. Antes de escribir

- Si existe `CLAUDE.md` en la raíz, léelo: lleva el contexto, la fase actual
  y las decisiones cerradas, que no se reabren sin permiso. No está en el
  repo (son notas internas, ver `.gitignore`), así que en un clon limpio no
  aparecerá — entonces guíate por `README.md` y `ARCHITECTURE.md`.
- Lee el archivo que vas a tocar entero antes de editarlo, y mira uno o dos
  vecinos: el código nuevo tiene que leerse como el que ya está.
- Busca antes de crear. Este repo ya tiene utilidades para casi todo
  (`lib/rateLimit.ts`, `lib/text.ts`, `lib/db.ts`, `ingest/slugify.ts`,
  adaptadores en `llm/`). Duplicar es peor que reutilizar.
- No trabajes de fases futuras salvo que se pida.

## 1. Convenciones no negociables

- **TypeScript estricto** (`tsconfig.base.json`: `strict`,
  `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`).
  Nada de `any` sin un comentario que justifique por qué.
- **ESM real**: imports relativos **siempre con extensión `.js`**
  (`import { runChat } from "../chat/index.js"`), aunque el fichero sea `.ts`.
- Todo `tsconfig.json` de paquete extiende `../../tsconfig.base.json`.
- **Comentarios solo del *porqué***, nunca del *qué*. El estándar del repo es
  el de `routes/chat.ts`: se comenta la razón no obvia (por qué se descarta un
  `sessionId` mal formado, por qué el error crudo no sale al cliente). Si el
  comentario reformula el código, sobra.
- **Cero dependencias nuevas** sin pedirlo explícitamente. Tampoco
  abstracciones para un caso futuro hipotético: se añade cuando hace falta.
- Nombres y mensajes de cara al usuario **en inglés** (README, dashboard,
  landing, docs, respuestas de la API). Comentarios y CLAUDE.md, en español.

## 2. Reglas por paquete

### `packages/server`
- Toda entrada de un endpoint se valida con **zod + `safeParse`**, nunca
  `parse` a pelo, y el body se parsea con `.catch(() => null)`.
- **Endpoints públicos no filtran detalles internos**: el error crudo (que
  puede llevar respuestas del proveedor de LLM) va a `console.error`; al
  cliente, un mensaje genérico y el status correcto.
- Cualquier ruta pública que llame al LLM lleva `chatRateLimit`. Si añades
  una nueva superficie de consumo, hereda los límites existentes en vez de
  inventar otros.
- **Migraciones**: append-only, numeradas (`000N_descripcion.sql`), nunca se
  edita una ya aplicada. Se ejecutan solas al arrancar (CMD del Dockerfile);
  asume que corren sobre la BD de producción de Neon.
- Nada de secretos ni claves en el código: todo por `.env` / variables de
  entorno, y nunca se loguean.

### `packages/widget`
- Es un bundle que se carga en webs ajenas: **peso y aislamiento importan**.
  Sin dependencias nuevas, estilos dentro del Shadow DOM, nada que pise el
  CSS o el `window` del anfitrión.
- Las opciones se exponen como atributos `data-*` documentados (ver
  `data-primary`, `data-position`, `data-suggestions`, `data-contact`).

### `packages/web`, `packages/docs`, `packages/dashboard`
- Modo claro y oscuro: si añades UI, tiene que verse bien en los dos.
- Todo lo visible, en inglés.

## 3. Reglas de producto (rompe esto y rompes el proyecto)

- **Cada respuesta cita sus fuentes.** Si no hay contexto recuperado, se
  responde "no lo sé" **sin llamar al LLM**. No inventes fallbacks que
  alucinen.
- **Privacy-first**: en self-hosted, ningún dato del usuario sale de su
  servidor. No añadas telemetría, analítica de terceros ni llamadas salientes.
- **Coste controlado**: el LLM es el coste variable. Antes de añadir una
  llamada más por petición, justifica por qué no vale con lo que ya se
  recupera.

## 4. Puerta de calidad (obligatoria antes de decir "hecho")

```bash
pnpm typecheck && pnpm lint && pnpm test
```

Los tres tienen que pasar limpios (es lo mismo que corre CI, más `pnpm build`).

Y además: **"compila" no es "funciona"**. Verifica el comportamiento de verdad
antes de darlo por bueno — arranca el server y ejerce el endpoint, o el widget
en el navegador, según lo que hayas tocado. Si no lo has ejercido, dilo
explícitamente en el resumen en vez de afirmar que funciona.

### Tests
- Van **junto al código**: `foo.ts` → `foo.test.ts`.
- `node:test` vía `tsx --test`.
- Si tocas lógica pura (chunking, ranking/RRF, prompts, rate limit), añades o
  actualizas su test. Si tocas I/O (BD, HTTP, LLM), la verificación es E2E.

## 5. Git

- Commits pequeños, uno por unidad lógica, mensaje imperativo que explique el
  **porqué** más que el qué.
- Nunca `.env` ni secretos en git.
- **Preguntar siempre a Mikel antes de `git push`.**

## 6. Al terminar

Resume en dos bloques: **qué has cambiado** y **cómo probarlo** (comandos
concretos). Si algo quedó sin verificar o has tomado una decisión discutible,
dilo ahí — no lo entierres.
