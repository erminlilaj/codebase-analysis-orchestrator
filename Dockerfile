FROM node:22-bookworm-slim AS deps

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS deps-prod

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-bookworm-slim AS build

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build:docker

FROM node:22-bookworm-slim AS runtime

ARG INSTALL_OPENCODE=true

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

RUN if [ "$INSTALL_OPENCODE" = "true" ]; then npm install -g opencode-ai; fi

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
COPY --from=deps-prod /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/COBOL_TEST ./COBOL_TEST
COPY docker/entrypoint.sh /usr/local/bin/codebase-analysis-entrypoint

RUN chmod +x /usr/local/bin/codebase-analysis-entrypoint \
  && mkdir -p /app/tmp/workspaces /app/exports /repositories

EXPOSE 3000
ENTRYPOINT ["codebase-analysis-entrypoint"]
CMD ["api"]
