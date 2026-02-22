import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { createDeviceRouter } from '@device-router/middleware-hono';
import type { DeviceRouterEnv } from '@device-router/middleware-hono';
import { MemoryStorageAdapter } from '@device-router/storage';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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
  const profile = c.get('deviceProfile');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>DeviceRouter Hono Example</title>
  <script src="/device-router-probe.min.js"></script>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; }
    pre { background: #f4f4f4; padding: 1rem; border-radius: 4px; overflow-x: auto; }
    .tier { display: inline-block; padding: 0.25rem 0.5rem; border-radius: 4px; font-weight: bold; }
    .tier-low { background: #fee; color: #c00; }
    .tier-mid { background: #ffe; color: #a80; }
    .tier-high { background: #efe; color: #080; }
  </style>
</head>
<body>
  <h1>DeviceRouter Hono Example</h1>
  ${
    profile
      ? `
  <h2>Device Profile Detected</h2>
  <p>CPU: <span class="tier tier-${profile.tiers.cpu}">${profile.tiers.cpu}</span></p>
  <p>Memory: <span class="tier tier-${profile.tiers.memory}">${profile.tiers.memory}</span></p>
  <p>Connection: <span class="tier tier-${profile.tiers.connection === 'fast' ? 'high' : profile.tiers.connection === '4g' ? 'mid' : 'low'}">${profile.tiers.connection}</span></p>
  <h3>Rendering Hints</h3>
  <pre>${JSON.stringify(profile.hints, null, 2)}</pre>
  <h3>Raw Signals</h3>
  <pre>${JSON.stringify(profile.profile.signals, null, 2)}</pre>
  `
      : `
  <p>No device profile yet. The probe script has been loaded — <strong>refresh the page</strong> to see your device profile.</p>
  `
  }
</body>
</html>`;

  return c.html(html);
});

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`Hono example running at http://localhost:${PORT}`);
});
