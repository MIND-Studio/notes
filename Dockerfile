# syntax=docker/dockerfile:1.7
#
# Production image for this Mind app. Two stages:
#   builder — installs deps and runs `next build` to emit .next/standalone.
#   runtime — minimal Debian-slim running the standalone server as non-root.
# Mirrors the drive image (no native modules).

# --- Stage 1: build --------------------------------------------------------
FROM node:22-bookworm-slim AS builder
WORKDIR /app

# `.npmrc` points the @mind-studio scope at GitHub Packages, reading the token
# from $NODE_AUTH_TOKEN passed as a BuildKit secret (never layer-baked).
COPY package.json package-lock.json .npmrc ./
RUN --mount=type=secret,id=node_auth_token \
    NODE_AUTH_TOKEN="$(cat /run/secrets/node_auth_token 2>/dev/null || true)" \
    npm ci --no-audit --no-fund

# Guarantee Next's native swc binary (npm/cli #4828; Turbopack has no WASM
# fallback). Public package, no GHCR auth; --no-save leaves the lockfile intact.
RUN npm install --no-save "@next/swc-linux-$(node -p process.arch)-gnu@$(node -p "require('next/package.json').version")"

COPY . .
RUN mkdir -p public

# NEXT_PUBLIC_* are inlined at build time (passed as build-args by the workflow).
ARG NEXT_PUBLIC_SOLID_ISSUER
ARG NEXT_PUBLIC_POD_BASE_URL
ENV NEXT_PUBLIC_SOLID_ISSUER=$NEXT_PUBLIC_SOLID_ISSUER \
    NEXT_PUBLIC_POD_BASE_URL=$NEXT_PUBLIC_POD_BASE_URL

RUN npm run build

# --- Stage 2: runtime ------------------------------------------------------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates tini \
 && rm -rf /var/lib/apt/lists/*

USER node

COPY --chown=node:node --from=builder /app/.next/standalone ./
COPY --chown=node:node --from=builder /app/.next/static ./.next/static
COPY --chown=node:node --from=builder /app/public ./public

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

EXPOSE 3000

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server.js"]
