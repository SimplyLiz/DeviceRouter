import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { createInjectionMiddleware } from '../inject.js';

describe('createInjectionMiddleware (hono)', () => {
  const probeScript = '(function(){console.log("probe")})()';

  it('injects script before </head> in HTML response', async () => {
    const app = new Hono();
    app.use('*', createInjectionMiddleware({ probeScript }));
    app.get('/', (c) => c.html('<html><head><title>Test</title></head><body></body></html>'));

    const res = await app.request('/');
    const body = await res.text();

    expect(body).toBe(
      `<html><head><title>Test</title><script>${probeScript}</script></head><body></body></html>`,
    );
  });

  it('falls back to </body> when no </head>', async () => {
    const app = new Hono();
    app.use('*', createInjectionMiddleware({ probeScript }));
    app.get('/', (c) => c.html('<html><body><p>Hello</p></body></html>'));

    const res = await app.request('/');
    const body = await res.text();

    expect(body).toBe(`<html><body><p>Hello</p><script>${probeScript}</script></body></html>`);
  });

  it('does not inject into non-HTML responses', async () => {
    const app = new Hono();
    app.use('*', createInjectionMiddleware({ probeScript }));
    app.get('/', (c) => c.json({ ok: true }));

    const res = await app.request('/');
    const data = (await res.json()) as { ok: boolean };

    expect(data.ok).toBe(true);
  });

  it('adds nonce attribute with static string', async () => {
    const app = new Hono();
    app.use('*', createInjectionMiddleware({ probeScript, nonce: 'abc123' }));
    app.get('/', (c) => c.html('<html><head></head><body></body></html>'));

    const res = await app.request('/');
    const body = await res.text();

    expect(body).toBe(
      `<html><head><script nonce="abc123">${probeScript}</script></head><body></body></html>`,
    );
  });

  it('adds nonce attribute with function', async () => {
    const getNonce = vi.fn(() => 'dynamic-nonce');
    const app = new Hono();
    app.use('*', createInjectionMiddleware({ probeScript, nonce: getNonce }));
    app.get('/', (c) => c.html('<html><head></head><body></body></html>'));

    const res = await app.request('/');
    const body = await res.text();

    expect(getNonce).toHaveBeenCalled();
    expect(body).toBe(
      `<html><head><script nonce="dynamic-nonce">${probeScript}</script></head><body></body></html>`,
    );
  });

  it('does not modify HTML without </head> or </body>', async () => {
    const app = new Hono();
    app.use('*', createInjectionMiddleware({ probeScript }));
    app.get('/', (c) => c.html('<div>fragment</div>'));

    const res = await app.request('/');
    const body = await res.text();

    expect(body).toBe('<div>fragment</div>');
  });
});
