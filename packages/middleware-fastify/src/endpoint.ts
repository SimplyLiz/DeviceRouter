import type { FastifyRequest, FastifyReply } from 'fastify';
import '@fastify/cookie';
import type { StorageAdapter } from '@device-router/storage';
import type { DeviceProfile, RawSignals, OnEventCallback } from '@device-router/types';
import { isValidSignals, isBotSignals, emitEvent } from '@device-router/types';
import { randomUUID } from 'node:crypto';

export interface EndpointOptions {
  storage: StorageAdapter;
  cookieName?: string;
  cookiePath?: string;
  cookieSecure?: boolean;
  ttl?: number;
  rejectBots?: boolean;
  onEvent?: OnEventCallback;
}

export function createProbeEndpoint(options: EndpointOptions) {
  const {
    storage,
    cookieName = 'dr_session',
    cookiePath = '/',
    cookieSecure = false,
    ttl = 86400,
    rejectBots = true,
    onEvent,
  } = options;

  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    let sessionToken: string | undefined;
    try {
      const signals = req.body as unknown;

      if (!isValidSignals(signals)) {
        reply.status(400).send({ ok: false, error: 'Invalid probe payload' });
        return;
      }

      const existingToken = req.cookies?.[cookieName];
      sessionToken = existingToken || randomUUID();

      if (rejectBots && isBotSignals(signals)) {
        emitEvent(onEvent, { type: 'bot:reject', sessionToken, signals });
        reply.status(403).send({ ok: false, error: 'Bot detected' });
        return;
      }

      const {
        userAgent: _userAgent,
        viewport: _viewport,
        ...storedSignals
      } = signals as RawSignals;

      const now = new Date();
      const profile: DeviceProfile = {
        schemaVersion: 1,
        sessionToken,
        createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + ttl * 1000).toISOString(),
        signals: storedSignals,
      };

      const start = performance.now();
      await storage.set(sessionToken, profile, ttl);
      const durationMs = performance.now() - start;

      emitEvent(onEvent, { type: 'profile:store', sessionToken, signals, durationMs });

      reply.setCookie(cookieName, sessionToken, {
        path: cookiePath,
        httpOnly: true,
        secure: cookieSecure,
        sameSite: 'lax',
        maxAge: ttl,
      });

      reply.send({ ok: true, sessionToken });
    } catch (err) {
      emitEvent(onEvent, {
        type: 'error',
        error: err,
        phase: 'endpoint',
        sessionToken,
      });
      reply.status(500).send({ ok: false, error: 'Internal server error' });
    }
  };
}
