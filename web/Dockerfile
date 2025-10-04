# syntax=docker/dockerfile:1.7

FROM node:20-bullseye-slim AS base
WORKDIR /app/web
ENV PNPM_HOME=/root/.local/share/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

COPY web/package.json ./package.json
COPY web/pnpm-lock.yaml* ./pnpm-lock.yaml
COPY db/prisma ../db/prisma

RUN pnpm install --frozen-lockfile && pnpm exec prisma generate --schema ../db/prisma/schema.prisma

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

ENV NODE_ENV=development
ENV PORT=3000
EXPOSE 3000

CMD ["pnpm", "dev"]
