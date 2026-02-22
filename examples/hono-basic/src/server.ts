import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { createDeviceRouter } from '@device-router/middleware-hono';
import type { DeviceRouterEnv } from '@device-router/middleware-hono';
import { MemoryStorageAdapter } from '@device-router/storage';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderDemoPage } from '../../shared/demo-template.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = new Hono<DeviceRouterEnv>();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Storage — swap MemoryStorageAdapter for RedisStorageAdapter in production
const storage = new MemoryStorageAdapter();

const { middleware, probeEndpoint } = createDeviceRouter({
  storage,
  ttl: 86400,
});

// Probe endpoint — receives device signals from the client
app.post('/device-router/probe', probeEndpoint);

// Serve the probe script (monorepo-relative path — in production, serve from node_modules or CDN)
app.get('/device-router-probe.min.js', (c) => {
  const probePath = resolve(__dirname, '../../../packages/probe/dist/device-router-probe.min.js');
  const script = readFileSync(probePath, 'utf-8');
  return c.text(script, 200, { 'Content-Type': 'application/javascript' });
});

// Device-aware middleware
app.use('*', middleware);

// Routes
app.get('/', (c) => {
  const html = renderDemoPage({
    profile: c.get('deviceProfile'),
    forceParam: c.req.query('force'),
    frameworkName: 'Hono',
  });
  return c.html(html);
});

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`Hono example running at http://localhost:${PORT}`);
});
