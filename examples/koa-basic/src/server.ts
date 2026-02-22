import Koa from 'koa';
import { createDeviceRouter } from '@device-router/middleware-koa';
import { MemoryStorageAdapter } from '@device-router/storage';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderDemoPage } from '../../shared/demo-template.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = new Koa();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Storage — swap MemoryStorageAdapter for RedisStorageAdapter in production
const storage = new MemoryStorageAdapter();

const { middleware, probeEndpoint } = createDeviceRouter({
  storage,
  ttl: 86400,
});

// Simple JSON body parser
app.use(async (ctx, next) => {
  if (ctx.method === 'POST' && ctx.is('application/json')) {
    const body = await new Promise<string>((resolve) => {
      let data = '';
      ctx.req.on('data', (chunk: Buffer) => {
        data += chunk.toString();
      });
      ctx.req.on('end', () => resolve(data));
    });
    (ctx.request as unknown as { body: unknown }).body = JSON.parse(body);
  }
  await next();
});

// Probe endpoint — receives device signals from the client
app.use(async (ctx, next) => {
  if (ctx.path === '/device-router/probe' && ctx.method === 'POST') {
    await probeEndpoint(ctx);
    return;
  }
  await next();
});

// Serve the probe script
app.use(async (ctx, next) => {
  if (ctx.path === '/device-router-probe.min.js' && ctx.method === 'GET') {
    const probePath = resolve(__dirname, '../../../packages/probe/dist/device-router-probe.min.js');
    const script = readFileSync(probePath, 'utf-8');
    ctx.type = 'application/javascript';
    ctx.body = script;
    return;
  }
  await next();
});

// Device-aware middleware
app.use(middleware);

// Routes
app.use(async (ctx) => {
  if (ctx.path === '/' && ctx.method === 'GET') {
    const html = renderDemoPage({
      profile: ctx.state.deviceProfile,
      forceParam: ctx.query.force as string | undefined,
      frameworkName: 'Koa',
    });
    ctx.type = 'html';
    ctx.body = html;
  }
});

app.listen(PORT, () => {
  console.log(`Koa example running at http://localhost:${PORT}`);
});
