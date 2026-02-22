import type { FastifyRequest, FastifyReply } from 'fastify';
import '@fastify/cookie';
import type { StorageAdapter } from '@device-router/storage';
import type { DeviceProfile, RawSignals } from '@device-router/types';
import { isValidSignals } from '@device-router/types';
import { randomUUID } from 'node:crypto';

export interface EndpointOptions {
  storage: StorageAdapter;
  cookieName?: string;
  cookiePath?: string;
  ttl?: number;
}

export function createProbeEndpoint(options: EndpointOptions) {
  const { storage, cookieName = 'dr_session', cookiePath = '/', ttl = 86400 } = options;

  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      const signals = req.body as unknown;

      if (!isValidSignals(signals)) {
        reply.status(400).send({ ok: false, error: 'Invalid probe payload' });
        return;
      }

      const existingToken = req.cookies?.[cookieName];
      const sessionToken = existingToken || randomUUID();

      const now = new Date();
      const profile: DeviceProfile = {
        schemaVersion: 1,
        sessionToken,
        createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + ttl * 1000).toISOString(),
        signals: signals as RawSignals,
      };

      await storage.set(sessionToken, profile, ttl);

      reply.setCookie(cookieName, sessionToken, {
        path: cookiePath,
        httpOnly: true,
        sameSite: 'lax',
        maxAge: ttl,
      });

      reply.send({ ok: true, sessionToken });
    } catch {
      reply.status(500).send({ ok: false, error: 'Internal server error' });
    }
  };
}
