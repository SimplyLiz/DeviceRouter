import express from 'express';
import cookieParser from 'cookie-parser';
import { createDeviceRouter } from '@device-router/middleware-express';
import { MemoryStorageAdapter } from '@device-router/storage';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderDemoPage } from '../../shared/demo-template.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Storage — swap MemoryStorageAdapter for RedisStorageAdapter in production
const storage = new MemoryStorageAdapter();

const { middleware, probeEndpoint } = createDeviceRouter({
  storage,
  ttl: 86400,
});

app.use(cookieParser());
app.use(express.json());

// Probe endpoint — receives device signals from the client
app.post('/device-router/probe', probeEndpoint);

// Serve the probe script (monorepo-relative path — in production, serve from node_modules or CDN)
app.get('/device-router-probe.min.js', (_req, res) => {
  const probePath = resolve(__dirname, '../../../packages/probe/dist/device-router-probe.min.js');
  const script = readFileSync(probePath, 'utf-8');
  res.type('application/javascript').send(script);
});

// Device-aware middleware
app.use(middleware);

// Routes
app.get('/', (req, res) => {
  const html = renderDemoPage({
    profile: req.deviceProfile,
    forceParam: req.query.force as string | undefined,
    frameworkName: 'Express',
  });
  res.type('html').send(html);
});

app.listen(PORT, () => {
  console.log(`Example app running at http://localhost:${PORT}`);
});
