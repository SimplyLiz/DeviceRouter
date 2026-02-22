import { describe, it, expect, vi } from 'vitest';
import { createInjectionMiddleware } from '../inject.js';
import type { Context, Next } from 'koa';

function createMockCtx(options: { body?: unknown; type?: string } = {}): Context {
  return {
    body: options.body,
    type: options.type || '',
  } as unknown as Context;
}

describe('createInjectionMiddleware (koa)', () => {
  const probeScript = '(function(){console.log("probe")})()';
  const noopNext: Next = () => Promise.resolve();

  it('injects script before </head> in HTML response', async () => {
    const mw = createInjectionMiddleware({ probeScript });
    const ctx = createMockCtx({
      body: '<html><head><title>Test</title></head><body></body></html>',
      type: 'text/html',
    });

    await mw(ctx, noopNext);

    expect(ctx.body).toBe(
      `<html><head><title>Test</title><script>${probeScript}</script></head><body></body></html>`,
    );
  });

  it('falls back to </body> when no </head>', async () => {
    const mw = createInjectionMiddleware({ probeScript });
    const ctx = createMockCtx({
      body: '<html><body><p>Hello</p></body></html>',
      type: 'text/html',
    });

    await mw(ctx, noopNext);

    expect(ctx.body).toBe(`<html><body><p>Hello</p><script>${probeScript}</script></body></html>`);
  });

  it('does not inject into non-HTML responses', async () => {
    const mw = createInjectionMiddleware({ probeScript });
    const jsonBody = JSON.stringify({ ok: true });
    const ctx = createMockCtx({ body: jsonBody, type: 'application/json' });

    await mw(ctx, noopNext);

    expect(ctx.body).toBe(jsonBody);
  });

  it('does not inject into non-string bodies', async () => {
    const mw = createInjectionMiddleware({ probeScript });
    const objBody = { ok: true };
    const ctx = createMockCtx({ body: objBody, type: 'text/html' });

    await mw(ctx, noopNext);

    expect(ctx.body).toBe(objBody);
  });

  it('adds nonce attribute with static string', async () => {
    const mw = createInjectionMiddleware({ probeScript, nonce: 'abc123' });
    const ctx = createMockCtx({
      body: '<html><head></head><body></body></html>',
      type: 'text/html',
    });

    await mw(ctx, noopNext);

    expect(ctx.body).toBe(
      `<html><head><script nonce="abc123">${probeScript}</script></head><body></body></html>`,
    );
  });

  it('adds nonce attribute with function', async () => {
    const getNonce = vi.fn(() => 'dynamic-nonce');
    const mw = createInjectionMiddleware({ probeScript, nonce: getNonce });
    const ctx = createMockCtx({
      body: '<html><head></head><body></body></html>',
      type: 'text/html',
    });

    await mw(ctx, noopNext);

    expect(getNonce).toHaveBeenCalledWith(ctx);
    expect(ctx.body).toBe(
      `<html><head><script nonce="dynamic-nonce">${probeScript}</script></head><body></body></html>`,
    );
  });

  it('does not modify HTML without </head> or </body>', async () => {
    const mw = createInjectionMiddleware({ probeScript });
    const partial = '<div>fragment</div>';
    const ctx = createMockCtx({ body: partial, type: 'text/html' });

    await mw(ctx, noopNext);

    expect(ctx.body).toBe(partial);
  });

  it('handles html shorthand type', async () => {
    const mw = createInjectionMiddleware({ probeScript });
    const ctx = createMockCtx({
      body: '<html><head></head><body></body></html>',
      type: 'html',
    });

    await mw(ctx, noopNext);

    expect(ctx.body).toContain('<script>');
  });
});
