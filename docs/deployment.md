# Deployment Guide

This guide covers deploying DeviceRouter in three environments: Docker (Node.js + Redis), Cloudflare Workers (edge), and serverless platforms (Lambda, Vercel, etc.).

## Docker (Node.js + Redis)

A production setup running Express with Redis storage behind a multi-stage Docker build.

### Dockerfile

```dockerfile
# -- Build stage --
FROM node:20-slim AS build
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
RUN pnpm install --frozen-lockfile
RUN pnpm build

# -- Runtime stage --
FROM node:20-slim
RUN corepack enable
WORKDIR /app

COPY --from=build /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=build /app/packages ./packages
COPY --from=build /app/node_modules ./node_modules
COPY server.ts ./

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "--import", "tsx", "server.ts"]
```

### docker-compose.yml

```yaml
services:
  app:
    build: .
    ports:
      - '3000:3000'
    environment:
      PORT: 3000
      REDIS_URL: redis://redis:6379
    depends_on:
      redis:
        condition: service_healthy

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    volumes:
      - redis-data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  redis-data:
```

### Application entry point

```typescript
// server.ts
import express from 'express';
import cookieParser from 'cookie-parser';
import Redis from 'ioredis';
import { createDeviceRouter } from '@device-router/middleware-express';
import { RedisStorageAdapter } from '@device-router/storage';

const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
const storage = new RedisStorageAdapter({ client: redis });

const { middleware, probeEndpoint, injectionMiddleware } = createDeviceRouter({
  storage,
  cookieSecure: true,
  injectProbe: true,
});

const app = express();
app.use(cookieParser());
app.use(express.json());

app.post('/device-router/probe', probeEndpoint);
app.use(injectionMiddleware!);
app.use(middleware);

app.get('/', (req, res) => {
  const profile = req.deviceProfile;
  if (profile?.hints.preferServerRendering) {
    return res.send('<html><body>Server-rendered page</body></html>');
  }
  res.send('<html><body>Full interactive experience</body></html>');
});

const port = parseInt(process.env.PORT ?? '3000', 10);
app.listen(port, () => console.log(`Listening on :${port}`));
```

### Production checklist

- **`cookieSecure: true`** — always enable when serving over HTTPS. The session cookie is never sent over plain HTTP.
- **Redis persistence** — the `redis-data` volume in the compose file persists data across restarts. For production, configure Redis AOF or RDB snapshots.
- **Health checks** — add a `/healthz` endpoint that verifies Redis connectivity.
- **Reverse proxy** — run behind nginx or a load balancer that handles TLS termination. DeviceRouter does not serve HTTPS itself.
- **TTL** — the default session TTL is 24 hours. Lower it if you want profiles to refresh more frequently.
- **Rate limiting** — DeviceRouter does not rate-limit the probe endpoint. Add rate limiting via your reverse proxy (nginx `limit_req`, Cloudflare rate limiting) or a framework-level rate limiter to prevent abuse.
- **Error handler (Express)** — Express's default error handler renders stack traces in HTML responses. Malformed JSON sent to the probe endpoint will trigger this before DeviceRouter code runs. Add a [custom error handler](https://expressjs.com/en/guide/error-handling.html) to return clean JSON errors in production.
## Changing classification thresholds

Stored profiles contain raw signals, not classification results. Classification happens on every request when the middleware reads a profile from storage. **However**, profiles that were stored under a previous deploy are not automatically re-collected — the same raw signals are re-classified with the new thresholds.

This is usually fine: the raw signals don't change, and re-classification with updated thresholds produces correct results for the data that was collected. The issue arises when your new thresholds rely on signals that the **old probe version didn't collect**, or when you want a clean break from stale data.

### When you need to worry

- You changed the probe to collect **new signals** and your thresholds depend on them — old profiles won't have those fields
- You want to guarantee every user gets a fresh classification from a clean probe submission

### Mitigation strategies

1. **Shorten TTL during rollout** — set `ttl: 3600` (1 hour) in the deploy that changes thresholds, then restore the normal TTL in the next deploy. Profiles rotate naturally.

2. **Flush storage on deploy** — run `FLUSHDB` (Redis) or clear your storage adapter as a deploy step. All users re-probe on their next visit.

   ```bash
   # In your deploy script
   redis-cli -u "$REDIS_URL" FLUSHDB
   ```

3. **Key-prefix rotation** — change `cookieName` (e.g. `dr_session_v2`). Existing cookies won't match, so every user starts fresh. Old keys expire via TTL.

4. **Do nothing** — if your threshold change only adjusts numeric boundaries (e.g. moving the `cpu` high/mid boundary from 6 to 8 cores), existing raw signals are re-classified correctly on the next request. No action needed.

## Cloudflare Workers (Edge)

The Hono middleware is edge-compatible — it uses no Node.js-specific APIs at runtime. However, there are two things to handle differently on Workers: storage and probe injection.

### Storage: Cloudflare KV adapter

Redis is not available on Cloudflare Workers. Implement a `StorageAdapter` backed by Cloudflare KV:

```typescript
// kv-storage.ts
import type { StorageAdapter, DeviceProfile } from '@device-router/types';

export class KVStorageAdapter implements StorageAdapter {
  constructor(private kv: KVNamespace) {}

  async get(sessionToken: string): Promise<DeviceProfile | null> {
    const value = await this.kv.get(sessionToken, 'json');
    return value as DeviceProfile | null;
  }

  async set(sessionToken: string, profile: DeviceProfile, ttlSeconds: number): Promise<void> {
    await this.kv.put(sessionToken, JSON.stringify(profile), { expirationTtl: ttlSeconds });
  }

  async delete(sessionToken: string): Promise<void> {
    await this.kv.delete(sessionToken);
  }

  async exists(sessionToken: string): Promise<boolean> {
    const value = await this.kv.get(sessionToken);
    return value !== null;
  }
}
```

### Worker entry point

```typescript
// src/index.ts
import { Hono } from 'hono';
import { createDeviceRouter } from '@device-router/middleware-hono';
import type { DeviceRouterEnv } from '@device-router/middleware-hono';
import { KVStorageAdapter } from './kv-storage';

type Bindings = { DEVICE_PROFILES: KVNamespace };
type Env = DeviceRouterEnv & { Bindings: Bindings };

const app = new Hono<Env>();

// Initialize per-request because KV binding comes from the request context
app.use('*', async (c, next) => {
  const storage = new KVStorageAdapter(c.env.DEVICE_PROFILES);
  const { middleware, probeEndpoint } = createDeviceRouter({ storage });

  if (c.req.path === '/device-router/probe' && c.req.method === 'POST') {
    return probeEndpoint(c, next);
  }

  return middleware(c, next);
});

app.get('/', (c) => {
  const profile = c.get('deviceProfile');
  return c.json({ tier: profile?.tiers.cpu ?? null });
});

export default app;
```

### wrangler.toml

```toml
name = "device-router-app"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[[kv_namespaces]]
binding = "DEVICE_PROFILES"
id = "your-kv-namespace-id"
```

Create the KV namespace:

```bash
npx wrangler kv namespace create DEVICE_PROFILES
```

### Probe injection on Workers

The `injectProbe: true` option does **not** work on Cloudflare Workers. It uses `readFileSync` at initialization to load the bundled probe script, which is a Node.js API unavailable on Workers.

Instead, inline the probe script tag in your HTML responses:

```typescript
app.get('/', (c) => {
  const profile = c.get('deviceProfile');
  return c.html(`
    <html>
      <head>
        <script src="https://unpkg.com/@device-router/probe/dist/device-router-probe.min.js"></script>
      </head>
      <body>
        <p>CPU tier: ${profile?.tiers.cpu ?? 'unknown'}</p>
      </body>
    </html>
  `);
});
```

Or serve the probe script from a static asset and reference it directly.

## Serverless (Lambda, Vercel, etc.)

DeviceRouter works on serverless platforms with one constraint: **use external storage**.

### Why MemoryStorageAdapter won't work

Serverless functions are stateless. Each invocation may run in a fresh container. `MemoryStorageAdapter` stores profiles in process memory, which is lost between invocations (or across concurrent instances). Profiles will never be found on subsequent requests.

### Recommended: Upstash Redis

[Upstash](https://upstash.com) provides HTTP-based Redis that works in any serverless environment — no persistent TCP connections required.

```typescript
import { Redis } from '@upstash/redis';
import { RedisStorageAdapter } from '@device-router/storage';
import IORedis from 'ioredis';

// Option 1: Use Upstash's REST-based client with ioredis compatibility
const redis = new IORedis(process.env.REDIS_URL!);
const storage = new RedisStorageAdapter({ client: redis });

// Then use `storage` in createDeviceRouter as usual
```

If `@device-router/storage`'s `RedisStorageAdapter` expects an `ioredis`-compatible client and your serverless runtime doesn't support TCP connections (like Cloudflare Workers), implement a custom `StorageAdapter` using the Upstash REST client directly:

```typescript
import { Redis } from '@upstash/redis';
import type { StorageAdapter, DeviceProfile } from '@device-router/types';

export class UpstashStorageAdapter implements StorageAdapter {
  constructor(private redis: Redis) {}

  async get(sessionToken: string): Promise<DeviceProfile | null> {
    return this.redis.get<DeviceProfile>(sessionToken);
  }

  async set(sessionToken: string, profile: DeviceProfile, ttlSeconds: number): Promise<void> {
    await this.redis.set(sessionToken, profile, { ex: ttlSeconds });
  }

  async delete(sessionToken: string): Promise<void> {
    await this.redis.del(sessionToken);
  }

  async exists(sessionToken: string): Promise<boolean> {
    const result = await this.redis.exists(sessionToken);
    return result === 1;
  }
}
```

### Cold starts

Not a concern. DeviceRouter middleware is lightweight — no heavy initialization, no large dependency trees. The probe script is ~1 KB. Classification and hint derivation are pure synchronous functions with no I/O.

### General pattern

Regardless of platform:

1. Use `RedisStorageAdapter` or a custom `StorageAdapter` with external persistence
2. Set `cookieSecure: true` (serverless platforms typically terminate TLS)
3. The middleware, probe endpoint, and classification logic are all stateless — they work identically across invocations
4. If your platform doesn't support `readFileSync` (edge runtimes), skip `injectProbe` and add the probe script tag manually
