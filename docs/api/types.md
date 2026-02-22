# @device-router/types API

## Functions

### `classify(signals: RawSignals): DeviceTiers`

Classifies raw device signals into capability tiers.

```typescript
import { classify } from '@device-router/types';

const tiers = classify({
  hardwareConcurrency: 8,
  deviceMemory: 8,
  connection: { effectiveType: '4g', downlink: 50 },
});
// { cpu: 'high', memory: 'high', connection: 'fast' }
```

### `deriveHints(tiers: DeviceTiers, signals?: RawSignals): RenderingHints`

Derives rendering hints from device tiers.

```typescript
import { classify, deriveHints } from '@device-router/types';

const tiers = classify(signals);
const hints = deriveHints(tiers, signals);
// { deferHeavyComponents: false, serveMinimalCSS: false, ... }
```

### `classifyCpu(hardwareConcurrency?: number): CpuTier`

Classifies CPU tier: `<=2` cores → `'low'`, `3-4` → `'mid'`, `5+` → `'high'`.

### `classifyMemory(deviceMemory?: number): MemoryTier`

Classifies memory tier: `<=2` GB → `'low'`, `2-4` → `'mid'`, `>4` → `'high'`.

### `classifyConnection(effectiveType?: string, downlink?: number): ConnectionTier`

Classifies connection tier based on Network Information API values.

### `classifyGpu(renderer?: string): GpuTier`

Classifies GPU tier from WebGL renderer string: no renderer → `'none'`, software renderers (SwiftShader, llvmpipe) → `'low'`, known high-end (RTX, Radeon RX 5000+, Apple M-series) → `'high'`, everything else → `'mid'`.

## TierThresholds

Custom thresholds for tier classification. All fields are optional — unset fields use built-in defaults.

### CpuThresholds

| Field           | Type     | Default | Description                      |
| --------------- | -------- | ------- | -------------------------------- |
| `lowUpperBound` | `number` | `2`     | Cores at or below → `'low'` tier |
| `midUpperBound` | `number` | `4`     | Cores at or below → `'mid'` tier |

### MemoryThresholds

| Field           | Type     | Default | Description                   |
| --------------- | -------- | ------- | ----------------------------- |
| `lowUpperBound` | `number` | `2`     | GB at or below → `'low'` tier |
| `midUpperBound` | `number` | `4`     | GB at or below → `'mid'` tier |

### ConnectionThresholds

| Field                  | Type     | Default | Description                    |
| ---------------------- | -------- | ------- | ------------------------------ |
| `downlink2gUpperBound` | `number` | `0.5`   | Mbps at or below → `'2g'` tier |
| `downlink3gUpperBound` | `number` | `2`     | Mbps at or below → `'3g'` tier |
| `downlink4gUpperBound` | `number` | `5`     | Mbps at or below → `'4g'` tier |

### Example

```typescript
import { classify } from '@device-router/types';

const tiers = classify(signals, {
  cpu: { lowUpperBound: 4, midUpperBound: 8 },
  memory: { midUpperBound: 8 },
  connection: { downlink4gUpperBound: 10 },
});
```

## Types

### `GpuTier`

```typescript
type GpuTier = 'none' | 'low' | 'mid' | 'high';
```

See [Profile Schema Reference](../profile-schema.md) for full type definitions.
