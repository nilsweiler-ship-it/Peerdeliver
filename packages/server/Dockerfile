# Shlep API — production image.
# Built from the monorepo root:  docker build -f packages/server/Dockerfile .
FROM node:22-slim AS build

# Prisma needs OpenSSL at build and runtime.
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Workspace manifests first — keeps the dependency layer cacheable.
COPY package.json package-lock.json* ./
COPY tsconfig.base.json tsconfig.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/

RUN npm install --workspaces --include-workspace-root --no-audit --no-fund

COPY packages/shared packages/shared
COPY packages/server packages/server

RUN npx prisma generate --schema packages/server/prisma/schema.prisma \
    && npm run build --workspace @peerdeliver/shared --if-present \
    && npm run build --workspace @peerdeliver/server

# ---------------------------------------------------------------- runtime ---
FROM node:22-slim AS runtime

RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/packages/server ./packages/server

WORKDIR /app/packages/server

EXPOSE 3001

# Apply migrations, then boot. Safe to re-run on every deploy.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
