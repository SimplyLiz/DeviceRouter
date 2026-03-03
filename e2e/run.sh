#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WORK_DIR=$(mktemp -d)
trap 'rm -rf "$WORK_DIR"' EXIT

echo "=== Packing all packages ==="
PACKAGES=(types probe storage middleware-express middleware-fastify middleware-hono middleware-koa)
for pkg in "${PACKAGES[@]}"; do
  pnpm --filter "@device-router/$pkg" pack --pack-destination "$WORK_DIR" > /dev/null 2>&1
  echo "  packed @device-router/$pkg"
done

echo "=== Setting up consumer project ==="
cat > "$WORK_DIR/package.json" << 'EOF'
{
  "name": "device-router-e2e",
  "private": true,
  "type": "module"
}
EOF

cd "$WORK_DIR"

# Install all tarballs + peer deps needed for the express middleware test
npm install --no-audit --no-fund \
  ./device-router-types-*.tgz \
  ./device-router-probe-*.tgz \
  ./device-router-storage-*.tgz \
  ./device-router-middleware-express-*.tgz \
  ./device-router-middleware-fastify-*.tgz \
  ./device-router-middleware-hono-*.tgz \
  ./device-router-middleware-koa-*.tgz \
  express@5 cookie-parser@1 \
  fastify@5 @fastify/cookie@11 \
  hono@4 \
  koa@3 2>/dev/null

echo "=== Running smoke test ==="
cp "$SCRIPT_DIR/smoke.mjs" "$WORK_DIR/smoke.mjs"
node smoke.mjs

echo "=== All e2e tests passed ==="
