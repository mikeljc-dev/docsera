# Contribuir a Docsera

[English](./CONTRIBUTING.md) · **Español**

Gracias por el interés. Esto es un proyecto joven (ver el [roadmap del
README](./README.es.md#roadmap)), así que las contribuciones más útiles ahora
mismo son: reportar bugs de uso real, proponer mejoras concretas, y PRs
pequeños y enfocados.

## Desarrollo local

```bash
pnpm install
pnpm db:up          # Postgres + pgvector vía Docker
pnpm db:migrate
pnpm --filter @docsera/server dev
```

Ver el [README](./README.md#desarrollo-local-sin-docker) para el resto de
paquetes (`widget`, `dashboard`) y la [configuración completa](./README.md#configuración).

## Antes de abrir un PR

```bash
pnpm typecheck
pnpm lint
pnpm test
```

Los tres deben pasar limpio. `pnpm test` de momento solo cubre
`packages/server` (lógica de ingesta/chunking y del chat) — si tocas esa
zona, añade o actualiza los tests correspondientes junto al código
(`*.test.ts` al lado del archivo que prueban).

## Estilo de código

- TypeScript estricto (ver `tsconfig.base.json`). Evita `any` sin
  justificar en un comentario.
- Sin comentarios que expliquen *qué* hace el código (eso ya lo dicen los
  nombres) — solo cuándo hay una razón no obvia detrás de una decisión.
- Commits pequeños, un cambio lógico por commit, mensaje en imperativo
  explicando el *por qué* más que el *qué*.
- No introduzcas abstracciones o dependencias nuevas para un caso
  hipotético futuro. Si hace falta, se añade cuando haga falta de verdad.

## Reportar bugs / proponer features

Usa las plantillas de [issues](../../issues/new/choose). Para bugs,
incluye pasos para reproducir y, si aplica, qué proveedor de LLM/embeddings
estabas usando (`LLM_PROVIDER`/`EMBEDDING_PROVIDER`) — muchos problemas son
específicos de un proveedor o modelo concreto.

## Licencia

Docsera es [AGPL-3.0](./LICENSE). Al contribuir, aceptas que tu
contribución se distribuya bajo la misma licencia.
