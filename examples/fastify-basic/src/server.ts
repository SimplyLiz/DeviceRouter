import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { createDeviceRouter } from '@device-router/middleware-fastify';
import { MemoryStorageAdapter } from '@device-router/storage';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderDemoPage } from '../../shared/demo-template.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = Fastify({ logger: true });
const PORT = parseInt(process.env.PORT || '3000', 10);

// Storage — swap MemoryStorageAdapter for RedisStorageAdapter in production
const storage = new MemoryStorageAdapter();

const { middleware, probeEndpoint } = createDeviceRouter({
  storage,
  ttl: 86400,
});

await app.register(cookie);

// Probe endpoint — receives device signals from the client
app.post('/device-router/probe', probeEndpoint);

// Serve the probe script (monorepo-relative path — in production, serve from node_modules or CDN)
app.get('/device-router-probe.min.js', (_req, reply) => {
  const probePath = resolve(__dirname, '../../../packages/probe/dist/device-router-probe.min.js');
  const script = readFileSync(probePath, 'utf-8');
  reply.type('application/javascript').send(script);
});

// Register the device-router preHandler hook
app.addHook('preHandler', middleware);

// Routes
app.get('/', (req, reply) => {
  const html = renderDemoPage({
    profile: req.deviceProfile,
    forceParam: (req.query as Record<string, string | undefined>).force,
    frameworkName: 'Fastify',
  });
  reply.type('text/html').send(html);
});

app.listen({ port: PORT }, () => {
  console.log(`Fastify example running at http://localhost:${PORT}`);
});
