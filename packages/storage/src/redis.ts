import type { DeviceProfile } from '@device-router/types';
import type { StorageAdapter } from './interface.js';

export interface RedisStorageOptions {
  keyPrefix?: string;
  client: {
    get(key: string): Promise<string | null>;
    set(key: string, value: string, ...args: string[]): Promise<unknown>;
    del(key: string | string[]): Promise<number>;
    exists(key: string): Promise<number>;
    keys(pattern: string): Promise<string[]>;
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
      const keys = await this.client.keys(`${this.prefix}*`);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
    } catch {
      // Gracefully degrade — keys will expire via TTL
    }
  }

  async count(): Promise<number> {
    try {
      const keys = await this.client.keys(`${this.prefix}*`);
      return keys.length;
    } catch {
      return 0;
    }
  }

  async keys(): Promise<string[]> {
    try {
      const keys = await this.client.keys(`${this.prefix}*`);
      return keys.map((k) => k.slice(this.prefix.length));
    } catch {
      return [];
    }
  }

  async has(sessionToken: string): Promise<boolean> {
    return this.exists(sessionToken);
  }
}
