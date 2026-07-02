# syntax=docker/dockerfile:1

# Node 24 = current LTS at time of writing. -slim (Debian) avoids musl/alpine
# quirks with esbuild/vitest native binaries.
FROM node:24-slim AS base
WORKDIR /app
ENV CI=true

# --- deps: install node_modules in a cached layer -------------------------- #
FROM base AS deps
# Copy only manifests so this layer is cached until dependencies change.
# package-lock.json is optional: if present we get reproducible `npm ci`,
# otherwise we fall back to `npm install` (which also writes a lockfile).
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# --- dev: full source, runs tests/typecheck/demo, or the Vite dev server ---- #
FROM deps AS dev
COPY . .
EXPOSE 5173
# Default: run the test suite. Override with e.g.
#   docker run --rm wosb npm run demo
#   docker run --rm -p 5173:5173 wosb npm run dev -- --host 0.0.0.0
CMD ["npm", "test"]

# --- web-build: produce the static production bundle ------------------------ #
FROM deps AS web-build
COPY . .
RUN npm run build   # -> /app/dist-web

# --- web: tiny static server for the built SPA ------------------------------ #
FROM nginx:1.27-alpine AS web
COPY --from=web-build /app/dist-web /usr/share/nginx/html
EXPOSE 80
# nginx:alpine's default config already serves index.html for the static app.
