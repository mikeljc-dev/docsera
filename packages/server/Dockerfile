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

RUN pnpm --filter @docsera/widget build \
  && mkdir -p packages/server/public \
  && cp packages/widget/dist/widget.js packages/server/public/widget.js

RUN pnpm --filter @docsera/dashboard build \
  && mkdir -p packages/server/public/dashboard \
  && cp -r packages/dashboard/dist/. packages/server/public/dashboard/

RUN pnpm --filter @docsera/server build

WORKDIR /app/packages/server
EXPOSE 3000

# Compilado, no transpilado en caliente: hasta la v0.3.0 esto arrancaba con
# `tsx src/index.ts`, lo que dejaba TypeScript y su transpilador en la ruta
# crítica de producción y hacía que un error de tipos apareciera al arrancar
# en vez de al construir.
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/index.js"]
