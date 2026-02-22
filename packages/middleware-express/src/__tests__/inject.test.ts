import { describe, it, expect, vi } from 'vitest';
import { createInjectionMiddleware } from '../inject.js';

function createMockReq() {
  return {} as unknown as import('express').Request;
}

describe('createInjectionMiddleware', () => {
  const probeScript = '(function(){console.log("probe")})()';

  it('injects script when content-type is not yet set (Express default)', () => {
    const mw = createInjectionMiddleware({ probeScript });
    const req = createMockReq();
    const originalSend = vi.fn().mockReturnThis();
    const res = {
      getHeader: vi.fn(() => undefined),
      send: originalSend,
    } as unknown as import('express').Response;

    mw(req, res, vi.fn());
    res.send('<html><head><title>Test</title></head><body></body></html>');

    expect(originalSend).toHaveBeenCalledWith(
      `<html><head><title>Test</title><script>${probeScript}</script></head><body></body></html>`,
    );
  });

  it('injects script into HTML string body', () => {
    const mw = createInjectionMiddleware({ probeScript });
    const req = createMockReq();
    const originalSend = vi.fn().mockReturnThis();
    const res = {
      getHeader: vi.fn(() => 'text/html'),
      send: originalSend,
    } as unknown as import('express').Response;

    const next = vi.fn();
    mw(req, res, next);

    // Now res.send is replaced
    res.send('<html><head></head><body></body></html>');

    expect(originalSend).toHaveBeenCalledWith(
      `<html><head><script>${probeScript}</script></head><body></body></html>`,
    );
  });

  it('falls back to </body> when no </head>', () => {
    const mw = createInjectionMiddleware({ probeScript });
    const req = createMockReq();
    const originalSend = vi.fn().mockReturnThis();
    const res = {
      getHeader: vi.fn(() => 'text/html'),
      send: originalSend,
    } as unknown as import('express').Response;

    mw(req, res, vi.fn());
    res.send('<html><body><p>Hello</p></body></html>');

    expect(originalSend).toHaveBeenCalledWith(
      `<html><body><p>Hello</p><script>${probeScript}</script></body></html>`,
    );
  });

  it('does not inject into non-HTML responses', () => {
    const mw = createInjectionMiddleware({ probeScript });
    const req = createMockReq();
    const originalSend = vi.fn().mockReturnThis();
    const res = {
      getHeader: vi.fn(() => 'application/json'),
      send: originalSend,
    } as unknown as import('express').Response;

    mw(req, res, vi.fn());
    const jsonBody = JSON.stringify({ ok: true });
    res.send(jsonBody);

    expect(originalSend).toHaveBeenCalledWith(jsonBody);
  });

  it('does not inject into non-string bodies', () => {
    const mw = createInjectionMiddleware({ probeScript });
    const req = createMockReq();
    const originalSend = vi.fn().mockReturnThis();
    const res = {
      getHeader: vi.fn(() => 'text/html'),
      send: originalSend,
    } as unknown as import('express').Response;

    mw(req, res, vi.fn());
    const bufferBody = Buffer.from('<html></html>');
    res.send(bufferBody);

    expect(originalSend).toHaveBeenCalledWith(bufferBody);
  });

  it('adds nonce attribute with static string', () => {
    const mw = createInjectionMiddleware({ probeScript, nonce: 'abc123' });
    const req = createMockReq();
    const originalSend = vi.fn().mockReturnThis();
    const res = {
      getHeader: vi.fn(() => 'text/html'),
      send: originalSend,
    } as unknown as import('express').Response;

    mw(req, res, vi.fn());
    res.send('<html><head></head><body></body></html>');

    expect(originalSend).toHaveBeenCalledWith(
      `<html><head><script nonce="abc123">${probeScript}</script></head><body></body></html>`,
    );
  });

  it('adds nonce attribute with function', () => {
    const getNonce = vi.fn(() => 'dynamic-nonce');
    const mw = createInjectionMiddleware({ probeScript, nonce: getNonce });
    const req = createMockReq();
    const originalSend = vi.fn().mockReturnThis();
    const res = {
      getHeader: vi.fn(() => 'text/html'),
      send: originalSend,
    } as unknown as import('express').Response;

    mw(req, res, vi.fn());
    res.send('<html><head></head><body></body></html>');

    expect(getNonce).toHaveBeenCalledWith(req);
    expect(originalSend).toHaveBeenCalledWith(
      `<html><head><script nonce="dynamic-nonce">${probeScript}</script></head><body></body></html>`,
    );
  });

  it('does not modify HTML without </head> or </body>', () => {
    const mw = createInjectionMiddleware({ probeScript });
    const req = createMockReq();
    const originalSend = vi.fn().mockReturnThis();
    const res = {
      getHeader: vi.fn(() => 'text/html'),
      send: originalSend,
    } as unknown as import('express').Response;

    mw(req, res, vi.fn());
    const partial = '<div>fragment</div>';
    res.send(partial);

    expect(originalSend).toHaveBeenCalledWith(partial);
  });
});
