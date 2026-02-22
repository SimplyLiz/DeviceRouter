# @device-router/storage API

## StorageAdapter Interface

```typescript
interface StorageAdapter {
  get(sessionToken: string): Promise<DeviceProfile | null>;
  set(sessionToken: string, profile: DeviceProfile, ttlSeconds: number): Promise<void>;
  delete(sessionToken: string): Promise<void>;
  exists(sessionToken: string): Promise<boolean>;
}
```

## MemoryStorageAdapter

In-memory storage using a `Map` with TTL-based expiry. Suitable for development and single-process deployments.

```typescript
import { MemoryStorageAdapter } from '@device-router/storage';

const storage = new MemoryStorageAdapter();
```

### Methods

- `clear(): void` — Removes all stored profiles

## RedisStorageAdapter

Redis-backed storage using `SET ... EX` for TTL. Suitable for production multi-process deployments.

```typescript
import Redis from 'ioredis';
import { RedisStorageAdapter } from '@device-router/storage';

const storage = new RedisStorageAdapter({
  client: new Redis(),
  keyPrefix: 'dr:profile:', // Default prefix
});
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `client` | Redis-compatible client | required | Must implement `get`, `set`, `del`, `exists` |
| `keyPrefix` | `string` | `'dr:profile:'` | Key prefix for Redis keys |
