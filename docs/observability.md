# Observability

DeviceRouter supports an `onEvent` callback for logging, metrics, and monitoring. Events are emitted during classification, storage, bot rejection, and error handling — without requiring middleware wrapping.

## Setup

Pass an `onEvent` callback to `createDeviceRouter()`:

```typescript
import { createDeviceRouter } from '@device-router/middleware-express';
import { MemoryStorageAdapter } from '@device-router/storage';

const { middleware, probeEndpoint } = createDeviceRouter({
  storage: new MemoryStorageAdapter(),
  onEvent: (event) => {
    console.log(`[device-router] ${event.type}`, event);
  },
});
```

The callback is available on all middleware packages (Express, Fastify, Hono, Koa).

## Event Types

Events use a discriminated union on the `type` field:

### `profile:classify`

Emitted after a device profile is classified — whether from stored probe signals, HTTP headers, or a fallback profile.

```typescript
{
  type: 'profile:classify';
  sessionToken: string; // Session token (empty string if no cookie)
  tiers: DeviceTiers; // { cpu, memory, connection, gpu }
  hints: RenderingHints; // { deferHeavyComponents, ... }
  source: ProfileSource; // 'probe' | 'headers' | 'fallback'
  durationMs: number; // Time spent classifying
}
```

### `profile:store`

Emitted after probe signals are validated and stored.

```typescript
{
  type: 'profile:store';
  sessionToken: string; // Session token
  signals: RawSignals; // Raw signals from the probe
  durationMs: number; // Time spent writing to storage
}
```

### `bot:reject`

Emitted when the probe endpoint rejects a bot submission.

```typescript
{
  type: 'bot:reject';
  sessionToken: string; // Session token
  signals: RawSignals; // The rejected signals
}
```

### `error`

Emitted when an error occurs in the middleware or endpoint.

```typescript
{
  type: 'error';
  error: unknown;             // The error object
  phase: 'middleware' | 'endpoint';
  sessionToken?: string;      // Session token if available
}
```

## Error Handling

The `onEvent` callback is wrapped so it never disrupts request handling:

- Synchronous exceptions are caught and swallowed
- Async rejections (if the callback returns a Promise) are caught and swallowed
- The callback is fire-and-forget — the middleware does not `await` it

This means you can safely do async work in the callback (e.g., send metrics to an external service) without affecting request latency or reliability.

## Examples

### Structured logging

```typescript
onEvent: (event) => {
  switch (event.type) {
    case 'profile:classify':
      logger.info('device classified', {
        session: event.sessionToken,
        source: event.source,
        cpu: event.tiers.cpu,
        memory: event.tiers.memory,
        durationMs: event.durationMs,
      });
      break;
    case 'profile:store':
      logger.info('profile stored', {
        session: event.sessionToken,
        durationMs: event.durationMs,
      });
      break;
    case 'bot:reject':
      logger.warn('bot rejected', { session: event.sessionToken });
      break;
    case 'error':
      logger.error('device-router error', {
        phase: event.phase,
        error: event.error,
      });
      break;
  }
};
```

### Prometheus metrics

```typescript
import { Counter, Histogram } from 'prom-client';

const classifyDuration = new Histogram({
  name: 'device_router_classify_duration_ms',
  help: 'Classification duration in milliseconds',
  labelNames: ['source'],
});

const storeDuration = new Histogram({
  name: 'device_router_store_duration_ms',
  help: 'Storage write duration in milliseconds',
});

const botRejects = new Counter({
  name: 'device_router_bot_rejects_total',
  help: 'Total bot rejections',
});

const errors = new Counter({
  name: 'device_router_errors_total',
  help: 'Total errors',
  labelNames: ['phase'],
});

onEvent: (event) => {
  switch (event.type) {
    case 'profile:classify':
      classifyDuration.observe({ source: event.source }, event.durationMs);
      break;
    case 'profile:store':
      storeDuration.observe(event.durationMs);
      break;
    case 'bot:reject':
      botRejects.inc();
      break;
    case 'error':
      errors.inc({ phase: event.phase });
      break;
  }
};
```

### Tier distribution tracking

```typescript
const tierCounts = new Counter({
  name: 'device_router_tier_total',
  help: 'Device tier distribution',
  labelNames: ['dimension', 'tier'],
});

onEvent: (event) => {
  if (event.type === 'profile:classify' && event.source === 'probe') {
    tierCounts.inc({ dimension: 'cpu', tier: event.tiers.cpu });
    tierCounts.inc({ dimension: 'memory', tier: event.tiers.memory });
    tierCounts.inc({ dimension: 'connection', tier: event.tiers.connection });
    tierCounts.inc({ dimension: 'gpu', tier: event.tiers.gpu });
  }
};
```

### Hint activation tracking

```typescript
const hintCounts = new Counter({
  name: 'device_router_hint_total',
  help: 'Hint activation counts',
  labelNames: ['hint'],
});

onEvent: (event) => {
  if (event.type === 'profile:classify') {
    for (const [hint, active] of Object.entries(event.hints)) {
      if (active) hintCounts.inc({ hint });
    }
  }
};
```

## TypeScript Types

```typescript
import type { DeviceRouterEvent, OnEventCallback } from '@device-router/types';
```

See the [types API reference](api/types.md#event-types) for full type definitions.

## Grafana Dashboard

The [`examples/observability/`](../examples/observability/) directory contains a complete Docker Compose stack (Express + Redis + Prometheus + Grafana) with all six metrics wired up and a pre-built Grafana dashboard that provisions automatically on startup.

```bash
cd examples/observability
docker compose up
# App at localhost:3000, Grafana at localhost:3001
```

The dashboard includes classification rate/latency panels, error and bot tracking, tier distribution pie charts, and hint activation rates. See the [example README](../examples/observability/README.md) for details.
