# Contributing to DeviceRouter

## Setup

```bash
# Clone the repo
git clone <repo-url>
cd DeviceRouter

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests with coverage
pnpm test:coverage
```

## Development Workflow

1. Create a feature branch from `develop`
2. Make your changes
3. Ensure all checks pass:
   ```bash
   pnpm build
   pnpm test:coverage
   pnpm lint
   pnpm format:check
   ```
4. Open a pull request against `develop`

## Project Structure

```
packages/
  types/              - Shared types, tier classification, rendering hints
  probe/              - Client-side capability probe
  storage/            - Storage adapters (memory, Redis)
  middleware-express/  - Express middleware
  middleware-fastify/  - Fastify plugin
  middleware-hono/     - Hono middleware
  middleware-koa/      - Koa middleware
examples/
  express-basic/      - Example Express app
  fastify-basic/      - Example Fastify app
  hono-basic/         - Example Hono app
  koa-basic/          - Example Koa app
```

## Guidelines

- Write tests for new functionality
- Keep the probe under 1 KB gzipped
- Follow existing code style (enforced by ESLint + Prettier)
- Use conventional commit messages

## Pull Requests

- Keep PRs focused on a single concern
- Include tests for new features and bug fixes
- Update documentation if applicable
