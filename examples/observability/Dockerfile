FROM node:20-alpine

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/ packages/
COPY examples/ examples/

RUN pnpm install --frozen-lockfile
RUN pnpm -r --filter='@device-router/*' run build

WORKDIR /app/examples/observability

EXPOSE 3000
CMD ["pnpm", "dev"]
