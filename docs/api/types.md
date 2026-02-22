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

## Types

See [Profile Schema Reference](../profile-schema.md) for full type definitions.
