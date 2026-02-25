import type { DeviceProfile } from '@device-router/types';

export interface StorageAdapter {
  get(sessionToken: string): Promise<DeviceProfile | null>;
  set(sessionToken: string, profile: DeviceProfile, ttlSeconds: number): Promise<void>;
  delete(sessionToken: string): Promise<void>;
  exists(sessionToken: string): Promise<boolean>;
  clear(): Promise<void>;
  count(): Promise<number>;
  keys(): Promise<string[]>;
}
