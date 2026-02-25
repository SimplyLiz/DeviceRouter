import type { DeviceProfile } from '@device-router/types';
import type { StorageAdapter } from './interface.js';

interface Entry {
  profile: DeviceProfile;
  expiresAt: number;
  timer: ReturnType<typeof setTimeout>;
}

export class MemoryStorageAdapter implements StorageAdapter {
  private store = new Map<string, Entry>();

  async get(sessionToken: string): Promise<DeviceProfile | null> {
    const entry = this.store.get(sessionToken);
    if (!entry) return null;
    if (Date.now() >= entry.expiresAt) {
      this.store.delete(sessionToken);
      clearTimeout(entry.timer);
      return null;
    }
    return entry.profile;
  }

  async set(sessionToken: string, profile: DeviceProfile, ttlSeconds: number): Promise<void> {
    const existing = this.store.get(sessionToken);
    if (existing) {
      clearTimeout(existing.timer);
    }

    const expiresAt = Date.now() + ttlSeconds * 1000;
    const timer = setTimeout(() => {
      this.store.delete(sessionToken);
    }, ttlSeconds * 1000);

    // Allow Node to exit even if timer is pending
    if (typeof timer === 'object' && 'unref' in timer) {
      timer.unref();
    }

    this.store.set(sessionToken, { profile, expiresAt, timer });
  }

  async delete(sessionToken: string): Promise<void> {
    const entry = this.store.get(sessionToken);
    if (entry) {
      clearTimeout(entry.timer);
      this.store.delete(sessionToken);
    }
  }

  async exists(sessionToken: string): Promise<boolean> {
    const profile = await this.get(sessionToken);
    return profile !== null;
  }

  async clear(): Promise<void> {
    for (const entry of this.store.values()) {
      clearTimeout(entry.timer);
    }
    this.store.clear();
  }

  async count(): Promise<number> {
    this.evictExpired();
    return this.store.size;
  }

  async keys(): Promise<string[]> {
    this.evictExpired();
    return [...this.store.keys()];
  }

  async has(sessionToken: string): Promise<boolean> {
    return this.exists(sessionToken);
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now >= entry.expiresAt) {
        clearTimeout(entry.timer);
        this.store.delete(key);
      }
    }
  }
}
