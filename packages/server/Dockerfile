# Construido con el contexto en la raiz del monorepo (ver docker-compose.yml:
# build.context: ., build.dockerfile: packages/server/Dockerfile), porque el
# server sirve tambien el bundle del widget y el build del dashboard, y
# necesita el workspace completo para instalarlos/compilarlos.
FROM node:20-alpine

WORKDIR /app

RUN corepack enable

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/server/package.json packages/server/package.json
COPY packages/widget/package.json packages/widget/package.json
COPY packages/dashboard/package.json packages/dashboard/package.json

RUN pnpm install --frozen-lockfile

COPY packages packages

RUN pnpm --filter @askdocs/widget build \
  && mkdir -p packages/server/public \
  && cp packages/widget/dist/widget.js packages/server/public/widget.js

RUN pnpm --filter @askdocs/dashboard build \
  && mkdir -p packages/server/public/dashboard \
  && cp -r packages/dashboard/dist/. packages/server/public/dashboard/

WORKDIR /app/packages/server
EXPOSE 3000

CMD ["sh", "-c", "pnpm exec tsx src/db/migrate.ts && pnpm exec tsx src/index.ts"]
