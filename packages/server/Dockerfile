# Construido con el contexto en la raiz del monorepo (ver docker-compose.yml:
# build.context: ., build.dockerfile: packages/server/Dockerfile), porque el
# server sirve tambien el bundle del widget y el build del dashboard, y
# necesita el workspace completo para instalarlos/compilarlos.
# Pineada por digest (no por tag flotante): Dependabot abre PR solo cuando
# hay uno nuevo para node:20-alpine, así que se sigue actualizando sin
# perder reproducibilidad entre builds.

# ─── Stage 1: builder ────────────────────────────────────────────
# Instala TODO (dev incluido), compila el widget, el dashboard y el server,
# y poda a un directorio autocontenido con solo dependencias de produccion.
# Nada de esto (devDeps, fuentes, tooling) llega a la imagen final.
FROM node:26-alpine@sha256:2d984a15c9b54fd0aeb608b8e0d0d83529eb34d2966db27a1fb4f1edc3d298a3 AS builder

WORKDIR /app

# Desde node:26-alpine, corepack ya no viene preinstalado (lo quitaron del
# runtime base); hay que traerlo de npm antes de poder habilitarlo.
RUN npm install -g corepack@latest && corepack enable

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

# `deploy --prod` clona el paquete con un node_modules autocontenido (solo
# dependencias de produccion, sin las dev). El server no depende de otros
# paquetes del workspace (widget/dashboard se compilan a assets estaticos y
# se copian aparte), asi que queda un directorio listo para ejecutar.
#
# --no-optional deja fuera onnxruntime-web/@huggingface/tokenizers (~132 MB,
# solo para el reranker opt-in): la imagen por defecto va ligera. Quien quiera
# reordenar reconstruye con --build-arg INSTALL_RERANKER=true; si se activa
# RERANKER_ENABLED sin ellas, el server cae a RRF con un log accionable.
ARG INSTALL_RERANKER=false
RUN if [ "$INSTALL_RERANKER" = "true" ]; then \
      pnpm --filter @docsera/server deploy --prod /prod; \
    else \
      pnpm --filter @docsera/server deploy --prod --no-optional /prod; \
    fi

# ─── Stage 2: runtime ────────────────────────────────────────────
# Solo Node + el paquete podado. Sin pnpm/corepack, sin devDeps, sin fuentes.
FROM node:26-alpine@sha256:2d984a15c9b54fd0aeb608b8e0d0d83529eb34d2966db27a1fb4f1edc3d298a3 AS runtime

WORKDIR /app/packages/server
ENV NODE_ENV=production

COPY --from=builder /prod/node_modules ./node_modules
COPY --from=builder /app/packages/server/dist ./dist
COPY --from=builder /app/packages/server/public ./public
COPY --from=builder /app/packages/server/package.json ./package.json

EXPOSE 3000

# Compilado, no transpilado en caliente: hasta la v0.3.0 esto arrancaba con
# `tsx src/index.ts`, lo que dejaba TypeScript y su transpilador en la ruta
# crítica de producción y hacía que un error de tipos apareciera al arrancar
# en vez de al construir.
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/index.js"]
