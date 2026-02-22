import type { DeviceProfile } from '@device-router/types';
import type { StorageAdapter } from './interface.js';

export interface RedisStorageOptions {
  keyPrefix?: string;
  client: {
    get(key: string): Promise<string | null>;
    set(key: string, value: string, ...args: string[]): Promise<unknown>;
    del(key: string): Promise<number>;
    exists(key: string): Promise<number>;
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
    const data = await this.client.get(this.key(sessionToken));
    if (!data) return null;
    return JSON.parse(data) as DeviceProfile;
  }

  async set(sessionToken: string, profile: DeviceProfile, ttlSeconds: number): Promise<void> {
    await this.client.set(this.key(sessionToken), JSON.stringify(profile), 'EX', String(ttlSeconds));
  }

  async delete(sessionToken: string): Promise<void> {
    await this.client.del(this.key(sessionToken));
  }

  async exists(sessionToken: string): Promise<boolean> {
    const result = await this.client.exists(this.key(sessionToken));
    return result > 0;
  }
}
