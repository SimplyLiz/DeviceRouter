# Observability Example

Demonstrates DeviceRouter's `onEvent` hook wired to Prometheus metrics, with a pre-built Grafana dashboard.

## What's Included

- **Express server** with all 6 Prometheus metrics wired to `onEvent`
- **Redis** for session storage
- **Prometheus** scraping the app every 5 seconds
- **Grafana** with a provisioned dashboard that loads automatically

## Quick Start

```bash
# From the repo root
pnpm install && pnpm build

# Start the stack
cd examples/observability
docker compose up
```

Open:

- **App** — http://localhost:3000 (hit this a few times to generate metrics)
- **Grafana** — http://localhost:3001 (anonymous admin access, no login required)
- **Prometheus** — http://localhost:9090

The DeviceRouter dashboard appears automatically in Grafana. Hit the app a few times, then check the dashboard — panels populate within seconds.

```bash
# Cleanup
docker compose down
```

## Metrics

| Metric                               | Type      | Labels              |
| ------------------------------------ | --------- | ------------------- |
| `device_router_classify_duration_ms` | Histogram | `source`            |
| `device_router_store_duration_ms`    | Histogram | —                   |
| `device_router_bot_rejects_total`    | Counter   | —                   |
| `device_router_errors_total`         | Counter   | `phase`             |
| `device_router_tier_total`           | Counter   | `dimension`, `tier` |
| `device_router_hint_total`           | Counter   | `hint`              |

## Dashboard Panels

**Row 1 — Operational health:**
Classification rate by source, classification latency percentiles (p50/p95/p99), storage write latency percentiles.

**Row 2 — Errors & bots:**
Error rate by phase (stacked), bot rejection rate, error + bot totals as stat panels.

**Row 3 — Device intelligence:**
Pie charts for CPU, memory, connection, and GPU tier distributions.

**Row 4 — Classification source & hints:**
Source distribution pie chart (probe vs headers vs fallback), hint activation rates as a bar gauge.

## Local Development (without Docker)

```bash
# Start Redis locally
redis-server

# Run the server
pnpm dev
```

Metrics are available at http://localhost:3000/metrics.

## Learn More

See the [Observability guide](../../docs/observability.md) for details on the `onEvent` hook, event types, and metric definitions.
