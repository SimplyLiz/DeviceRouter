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

# Run tests
pnpm test
```

## Development Workflow

1. Create a feature branch from `main`
2. Make your changes
3. Ensure all checks pass:
   ```bash
   pnpm build
   pnpm test
   pnpm lint
   pnpm format:check
   ```
4. Open a pull request

## Project Structure

```
packages/
  types/          - Shared types, tier classification, rendering hints
  probe/          - Client-side capability probe
  storage/        - Storage adapters (memory, Redis)
  middleware-express/ - Express middleware
examples/
  express-basic/  - Example Express app
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
