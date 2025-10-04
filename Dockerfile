# syntax=docker/dockerfile:1.7

FROM node:20-bullseye-slim AS base
WORKDIR /app
ENV PNPM_HOME=/root/.local/share/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

COPY package.json ./package.json
COPY pnpm-lock.yaml ./pnpm-lock.yaml
COPY prisma ./prisma

RUN pnpm install --frozen-lockfile \
  && pnpm exec prisma generate --schema prisma/schema.prisma

COPY tsconfig.json ./tsconfig.json
COPY next.config.ts ./next.config.ts
COPY tailwind.config.ts ./tailwind.config.ts
COPY postcss.config.mjs ./postcss.config.mjs
COPY eslint.config.mjs ./eslint.config.mjs
COPY config ./config
COPY src ./src
COPY public ./public
COPY lib ./lib
COPY types ./types

ENV NODE_ENV=development
ENV PORT=3000
EXPOSE 3000

CMD ["pnpm", "dev"]
