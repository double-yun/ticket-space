# syntax=docker/dockerfile:1.7

FROM node:20-bullseye-slim AS base
WORKDIR /app/web
ENV PNPM_HOME=/root/.local/share/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS deps
COPY web/package.json ./package.json
COPY web/pnpm-lock.yaml* ./pnpm-lock.yaml
COPY db/prisma ../db/prisma
RUN pnpm install --frozen-lockfile
RUN pnpm exec prisma generate --schema ../db/prisma/schema.prisma

FROM base AS builder
COPY web/package.json ./package.json
COPY web/pnpm-lock.yaml* ./pnpm-lock.yaml
COPY web/tsconfig.json ./tsconfig.json
COPY web/next.config.ts ./next.config.ts
COPY web/tailwind.config.ts ./tailwind.config.ts
COPY web/postcss.config.mjs ./postcss.config.mjs
COPY web/eslint.config.mjs ./eslint.config.mjs
COPY web/next-env.d.ts ./next-env.d.ts
COPY web/src ./src
COPY web/public ./public
COPY web/lib ./lib
COPY web/types ./types
COPY db/prisma ../db/prisma
COPY --from=deps /app/web/node_modules ./node_modules
RUN pnpm build

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app/web
COPY --from=builder /app/web/public ./public
COPY --from=builder /app/web/.next/standalone ./standalone
COPY --from=builder /app/web/.next/static ./.next/static
COPY --from=builder /app/db/prisma ../db/prisma
ENV PORT=3000
EXPOSE 3000
CMD ["node", "standalone/server.js"]

FROM base AS dev
WORKDIR /app/web
COPY web/package.json ./package.json
COPY web/pnpm-lock.yaml* ./pnpm-lock.yaml
COPY db/prisma ../db/prisma
RUN pnpm install
RUN pnpm exec prisma generate --schema ../db/prisma/schema.prisma
CMD ["pnpm", "dev"]
