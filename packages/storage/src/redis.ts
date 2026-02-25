import type { DeviceProfile } from '@device-router/types';
import type { StorageAdapter } from './interface.js';

export interface RedisStorageOptions {
  keyPrefix?: string;
  client: {
    get(key: string): Promise<string | null>;
    set(key: string, value: string, ...args: string[]): Promise<unknown>;
    del(key: string | string[]): Promise<number>;
    exists(key: string): Promise<number>;
    /** Fallback used when `scan` is not available. Blocks the Redis event loop on large datasets. */
    keys(pattern: string): Promise<string[]>;
    /** Optional SCAN-based iteration. Preferred over `keys` for production use. */
    scan?(cursor: number, ...args: string[]): Promise<[string, string[]]>;
  };
}

export class RedisStorageAdapter implements StorageAdapter {
  private readonly prefix: string;
  private readonly client: RedisStorageOptions['client'];

  constructor(options: RedisStorageOptions) {
    this.prefix = options.keyPrefix ?? 'dr:profile:';
    this.client = options.client;
  }

  private key(sessionToken: string): string {
    return `${this.prefix}${sessionToken}`;
  }

  private async scanKeys(): Promise<string[]> {
    if (!this.client.scan) {
      return this.client.keys(`${this.prefix}*`);
    }

    const allKeys: string[] = [];
    let cursor = 0;
    do {
      const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', `${this.prefix}*`);
      cursor = typeof nextCursor === 'string' ? parseInt(nextCursor, 10) : nextCursor;
      allKeys.push(...keys);
    } while (cursor !== 0);
    return allKeys;
  }

  async get(sessionToken: string): Promise<DeviceProfile | null> {
    try {
      const data = await this.client.get(this.key(sessionToken));
      if (!data) return null;
      return JSON.parse(data) as DeviceProfile;
    } catch {
      return null;
    }
  }

  async set(sessionToken: string, profile: DeviceProfile, ttlSeconds: number): Promise<void> {
    try {
      await this.client.set(
        this.key(sessionToken),
        JSON.stringify(profile),
        'EX',
        String(ttlSeconds),
      );
    } catch {
      // Gracefully degrade — profile won't be stored, probe will re-run next session
    }
  }

  async delete(sessionToken: string): Promise<void> {
    try {
      await this.client.del(this.key(sessionToken));
    } catch {
      // Gracefully degrade — key will expire via TTL
    }
  }

  async exists(sessionToken: string): Promise<boolean> {
    try {
      const result = await this.client.exists(this.key(sessionToken));
      return result > 0;
    } catch {
      return false;
    }
  }

  async clear(): Promise<void> {
    try {
      const keys = await this.scanKeys();
      if (keys.length > 0) {
        await this.client.del(keys);
      }
    } catch {
      // Gracefully degrade — keys will expire via TTL
    }
  }

  async count(): Promise<number> {
    try {
      const keys = await this.scanKeys();
      return keys.length;
    } catch {
      return 0;
    }
  }

  async keys(): Promise<string[]> {
    try {
      const keys = await this.scanKeys();
      return keys.map((k) => k.slice(this.prefix.length));
    } catch {
      return [];
    }
  }
}
