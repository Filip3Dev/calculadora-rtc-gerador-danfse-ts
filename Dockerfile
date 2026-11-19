# ── Estágio 1: build core + api ──────────────────────────────────────────────
# linux/amd64: exigência do Cloudflare Containers (build em Apple Silicon é emulado)
FROM --platform=linux/amd64 node:22-slim AS build
WORKDIR /app
RUN corepack enable
COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/core/package.json packages/core/
# sem --ignore-scripts: sem binding nativo aqui (pdf-lib/qrcode são JS puro)
COPY apps/playground/package.json apps/playground/
RUN pnpm install --filter @danfse/core --frozen-lockfile=false
COPY packages/core packages/core
RUN pnpm --filter @danfse/core build
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile=false
COPY apps/api apps/api
RUN pnpm --filter @danfse/api build

# ── Estágio 2: runtime ───────────────────────────────────────────────────────
FROM --platform=linux/amd64 node:22-slim AS run
WORKDIR /app
ENV NODE_ENV=production PORT=8080
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
# node_modules dos pacotes (linker isolado do pnpm): symlinks necessários no runtime
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/packages/core/node_modules ./packages/core/node_modules
COPY --from=build /app/packages/core/dist ./packages/core/dist
COPY --from=build /app/packages/core/package.json ./packages/core/
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/
COPY --from=build /app/apps/playground/package.json ./apps/playground/
EXPOSE 8080
WORKDIR /app/apps/api
CMD ["node", "dist/main.js"]
