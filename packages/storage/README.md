# @device-router/storage

Storage adapters for persisting device profiles in [DeviceRouter](https://github.com/SimplyLiz/DeviceRouter). Ships with in-memory and Redis adapters.

## Installation

```bash
pnpm add @device-router/storage
```

For Redis support:

```bash
pnpm add @device-router/storage ioredis
```

## Usage

### In-memory (development)

Profiles are stored in a `Map` with automatic TTL expiration. Suitable for single-process development and testing.

```typescript
import { MemoryStorageAdapter } from '@device-router/storage';

const storage = new MemoryStorageAdapter();
```

### Redis (production)

For multi-process and multi-server deployments. Uses Redis `EX` for TTL.

```typescript
import { RedisStorageAdapter } from '@device-router/storage';
import Redis from 'ioredis';

const redis = new Redis();
const storage = new RedisStorageAdapter({
  client: redis,
  keyPrefix: 'dr:profile:', // default
});
```

The `client` option accepts any object with `get`, `set`, `del`, and `exists` methods matching the ioredis interface. This means you can use any Redis-compatible client.

### Custom adapter

Implement the `StorageAdapter` interface:

```typescript
import type { StorageAdapter } from '@device-router/storage';
import type { DeviceProfile } from '@device-router/types';

class MyAdapter implements StorageAdapter {
  async get(sessionToken: string): Promise<DeviceProfile | null> { /* ... */ }
  async set(sessionToken: string, profile: DeviceProfile, ttlSeconds: number): Promise<void> { /* ... */ }
  async delete(sessionToken: string): Promise<void> { /* ... */ }
  async exists(sessionToken: string): Promise<boolean> { /* ... */ }
}
```

## API

### `StorageAdapter` interface

| Method   | Signature                                                          | Description                  |
| -------- | ------------------------------------------------------------------ | ---------------------------- |
| `get`    | `(sessionToken: string) => Promise<DeviceProfile \| null>`         | Retrieve a profile           |
| `set`    | `(sessionToken: string, profile: DeviceProfile, ttl: number) => Promise<void>` | Store with TTL (seconds) |
| `delete` | `(sessionToken: string) => Promise<void>`                          | Remove a profile             |
| `exists` | `(sessionToken: string) => Promise<boolean>`                       | Check if a profile exists    |

### `MemoryStorageAdapter`

Implements `StorageAdapter` plus:

- `clear()` — Remove all entries and cancel timers

### `RedisStorageAdapter`

Constructor options:

| Option      | Type     | Default         | Description               |
| ----------- | -------- | --------------- | ------------------------- |
| `client`    | `object` | *(required)*    | Redis-compatible client   |
| `keyPrefix` | `string` | `'dr:profile:'` | Key prefix for all entries |

## License

MIT
