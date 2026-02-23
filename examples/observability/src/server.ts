import express from 'express';
import cookieParser from 'cookie-parser';
import { createDeviceRouter } from '@device-router/middleware-express';
import { RedisStorageAdapter } from '@device-router/storage';
import { Counter, Histogram, Registry } from 'prom-client';
import IORedis from 'ioredis';
import type { RedisStorageOptions } from '@device-router/storage';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderDemoPage } from '../../shared/demo-template.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// ---------- Redis storage ----------

const redis = new IORedis.default({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  maxRetriesPerRequest: 3,
});

const storage = new RedisStorageAdapter({
  client: redis as unknown as RedisStorageOptions['client'],
});

// ---------- Prometheus metrics ----------

const register = new Registry();

const classifyDuration = new Histogram({
  name: 'device_router_classify_duration_ms',
  help: 'Classification duration in milliseconds',
  labelNames: ['source'] as const,
  buckets: [1, 2, 5, 10, 25, 50, 100],
  registers: [register],
});

const storeDuration = new Histogram({
  name: 'device_router_store_duration_ms',
  help: 'Storage write duration in milliseconds',
  buckets: [1, 5, 10, 25, 50, 100, 250],
  registers: [register],
});

const botRejects = new Counter({
  name: 'device_router_bot_rejects_total',
  help: 'Total bot rejections',
  registers: [register],
});

const errors = new Counter({
  name: 'device_router_errors_total',
  help: 'Total errors',
  labelNames: ['phase'] as const,
  registers: [register],
});

const tierCounts = new Counter({
  name: 'device_router_tier_total',
  help: 'Device tier distribution',
  labelNames: ['dimension', 'tier'] as const,
  registers: [register],
});

const hintCounts = new Counter({
  name: 'device_router_hint_total',
  help: 'Hint activation counts',
  labelNames: ['hint'] as const,
  registers: [register],
});

// ---------- DeviceRouter ----------

const { middleware, probeEndpoint } = createDeviceRouter({
  storage,
  ttl: 86400,
  classifyFromHeaders: true,
  fallbackProfile: 'conservative',
  onEvent: (event) => {
    switch (event.type) {
      case 'profile:classify':
        classifyDuration.observe({ source: event.source }, event.durationMs);
        tierCounts.inc({ dimension: 'cpu', tier: event.tiers.cpu });
        tierCounts.inc({ dimension: 'memory', tier: event.tiers.memory });
        tierCounts.inc({ dimension: 'connection', tier: event.tiers.connection });
        tierCounts.inc({ dimension: 'gpu', tier: event.tiers.gpu });
        for (const [hint, active] of Object.entries(event.hints)) {
          if (active) hintCounts.inc({ hint });
        }
        break;
      case 'profile:store':
        storeDuration.observe(event.durationMs);
        break;
      case 'bot:reject':
        botRejects.inc();
        break;
      case 'error':
        errors.inc({ phase: event.phase });
        break;
    }
  },
});

// ---------- Express setup ----------

app.use(cookieParser());
app.use(express.json());

// Probe endpoint
app.post('/device-router/probe', probeEndpoint);

// Serve probe script
app.get('/device-router-probe.min.js', (_req, res) => {
  const probePath = resolve(__dirname, '../../../packages/probe/dist/device-router-probe.min.js');
  const script = readFileSync(probePath, 'utf-8');
  res.type('application/javascript').send(script);
});

// Prometheus metrics endpoint
app.get('/metrics', async (_req, res) => {
  res.type(register.contentType).send(await register.metrics());
});

// Device-aware middleware
app.use(middleware);

// Routes
app.get('/', (req, res) => {
  const html = renderDemoPage({
    profile: req.deviceProfile,
    forceParam: req.query.force as string | undefined,
    frameworkName: 'Express + Observability',
  });
  res.type('html').send(html);
});

app.listen(PORT, () => {
  console.log(`Observability example running at http://localhost:${PORT}`);
  console.log(`Metrics at http://localhost:${PORT}/metrics`);
});
