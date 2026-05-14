FROM node:24-bookworm-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json

# npm ci on bookworm (glibc) will install @rollup/rollup-linux-x64-gnu correctly
RUN npm ci

COPY client ./client
COPY server ./server
COPY shared ./shared

# Build both workspaces
RUN npm run build

# ── Slim runtime ─────────────────────────────────────────────────────────────
FROM node:24-bookworm-slim AS runtime
WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json

RUN npm ci --workspace server --omit=dev

COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/server/dist ./server/dist
COPY shared ./shared

EXPOSE 4000
ENV NODE_ENV=production

CMD ["node", "server/dist/index.js"]
