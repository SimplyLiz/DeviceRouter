import { describe, it, expect, vi } from 'vitest';
import { createInjectionMiddleware } from '../inject.js';
import type { FastifyRequest, FastifyReply } from 'fastify';

function createMockReq() {
  return {} as unknown as FastifyRequest;
}

function createMockReply(contentType?: string) {
  return {
    getHeader: vi.fn(() => contentType),
  } as unknown as FastifyReply;
}

describe('createInjectionMiddleware', () => {
  const probeScript = '(function(){console.log("probe")})()';

  it('injects script before </head> in HTML payload', () => {
    const hook = createInjectionMiddleware({ probeScript });
    const done = vi.fn();

    hook(
      createMockReq(),
      createMockReply('text/html'),
      '<html><head><title>Test</title></head><body></body></html>',
      done,
    );

    expect(done).toHaveBeenCalledWith(
      null,
      `<html><head><title>Test</title><script>${probeScript}</script></head><body></body></html>`,
    );
  });

  it('falls back to </body> when no </head>', () => {
    const hook = createInjectionMiddleware({ probeScript });
    const done = vi.fn();

    hook(
      createMockReq(),
      createMockReply('text/html'),
      '<html><body><p>Hello</p></body></html>',
      done,
    );

    expect(done).toHaveBeenCalledWith(
      null,
      `<html><body><p>Hello</p><script>${probeScript}</script></body></html>`,
    );
  });

  it('does not inject into non-HTML responses', () => {
    const hook = createInjectionMiddleware({ probeScript });
    const done = vi.fn();
    const jsonPayload = JSON.stringify({ ok: true });

    hook(createMockReq(), createMockReply('application/json'), jsonPayload, done);

    expect(done).toHaveBeenCalledWith(null, jsonPayload);
  });

  it('does not inject into non-string payloads', () => {
    const hook = createInjectionMiddleware({ probeScript });
    const done = vi.fn();

    hook(
      createMockReq(),
      createMockReply('text/html'),
      Buffer.from('<html></html>') as unknown as string,
      done,
    );

    expect(done).toHaveBeenCalledWith(null, expect.anything());
  });

  it('adds nonce attribute with static string', () => {
    const hook = createInjectionMiddleware({ probeScript, nonce: 'abc123' });
    const done = vi.fn();

    hook(
      createMockReq(),
      createMockReply('text/html'),
      '<html><head></head><body></body></html>',
      done,
    );

    expect(done).toHaveBeenCalledWith(
      null,
      `<html><head><script nonce="abc123">${probeScript}</script></head><body></body></html>`,
    );
  });

  it('adds nonce attribute with function', () => {
    const getNonce = vi.fn(() => 'dynamic-nonce');
    const hook = createInjectionMiddleware({ probeScript, nonce: getNonce });
    const req = createMockReq();
    const done = vi.fn();

    hook(req, createMockReply('text/html'), '<html><head></head><body></body></html>', done);

    expect(getNonce).toHaveBeenCalledWith(req);
    expect(done).toHaveBeenCalledWith(
      null,
      `<html><head><script nonce="dynamic-nonce">${probeScript}</script></head><body></body></html>`,
    );
  });

  it('does not modify HTML without </head> or </body>', () => {
    const hook = createInjectionMiddleware({ probeScript });
    const done = vi.fn();
    const partial = '<div>fragment</div>';

    hook(createMockReq(), createMockReply('text/html'), partial, done);

    expect(done).toHaveBeenCalledWith(null, partial);
  });

  it('does not inject when content-type header is not set', () => {
    const hook = createInjectionMiddleware({ probeScript });
    const done = vi.fn();

    hook(
      createMockReq(),
      createMockReply(undefined),
      '<html><head></head><body></body></html>',
      done,
    );

    expect(done).toHaveBeenCalledWith(null, '<html><head></head><body></body></html>');
  });
});
