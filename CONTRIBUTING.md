# Contributing to Docsera

**English** · [Español](./CONTRIBUTING.es.md)

Thanks for your interest. This is a young project (see the
[README roadmap](./README.md#roadmap)), so the most useful contributions
right now are: reporting bugs from real usage, proposing concrete
improvements, and small, focused PRs.

## Local development

```bash
pnpm install
pnpm db:up          # Postgres + pgvector via Docker
pnpm db:migrate
pnpm --filter @docsera/server dev
```

See the [README](./README.md#local-development-without-docker) for the rest
of the packages (`widget`, `dashboard`) and the
[full configuration](./README.md#configuration).

## Before opening a PR

```bash
pnpm typecheck
pnpm lint
pnpm test
```

All three must pass clean. `pnpm test` currently only covers
`packages/server` (ingestion/chunking and chat logic) — if you touch that
area, add or update the corresponding tests next to the code
(`*.test.ts` beside the file they test).

## Code style

- Strict TypeScript (see `tsconfig.base.json`). Avoid `any` unless
  justified in a comment.
- No comments explaining *what* the code does (the names already say that) —
  only when there's a non-obvious reason behind a decision.
- Small commits, one logical change per commit, imperative message
  explaining the *why* more than the *what*.
- Don't introduce abstractions or new dependencies for a hypothetical
  future case. If it's needed, it gets added when it's actually needed.

## Reporting bugs / proposing features

Use the [issue templates](../../issues/new/choose). For bugs, include steps
to reproduce and, if applicable, which LLM/embeddings provider you were
using (`LLM_PROVIDER`/`EMBEDDING_PROVIDER`) — many problems are specific to
a particular provider or model.

## License

Docsera is [AGPL-3.0](./LICENSE). By contributing, you agree that your
contribution is distributed under the same license.
