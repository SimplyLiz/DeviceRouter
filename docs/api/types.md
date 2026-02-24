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
// { cpu: 'high', memory: 'high', connection: 'high', gpu: 'none' }
```

### `deriveHints(tiers: DeviceTiers, signals?: RawSignals): RenderingHints`

Derives rendering hints from device tiers.

The `battery` signal bypasses tier classification entirely — it's transient state, not a capability. When the device is unplugged and below 15% charge, `deferHeavyComponents`, `reduceAnimations`, and `disableAutoplay` are forced on to conserve power.

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

### `classifyGpu(renderer?: string, thresholds?: Partial<GpuThresholds>): GpuTier`

Classifies GPU tier from WebGL renderer string: no renderer → `'none'`, software renderers (SwiftShader, llvmpipe) → `'low'`, known high-end (RTX, Radeon RX 5000+, Apple M-series) → `'high'`, everything else → `'mid'`. Patterns are customizable via `GpuThresholds`.

### `validateThresholds(thresholds: TierThresholds): void`

Validates custom tier thresholds after merging with defaults. Throws a descriptive error if any rules are violated. Called automatically by `createDeviceRouter()` in all middleware packages — you only need to call this directly if using `classify()` standalone.

**Validation rules:**

- **CPU/Memory**: `lowUpperBound` must be less than `midUpperBound`
- **Connection**: `downlink2gUpperBound` < `downlink3gUpperBound` < `downlink4gUpperBound`
- **GPU**: `softwarePattern` and `highEndPattern` must be `RegExp` instances
- All numeric values must be positive (> 0)

Partial thresholds are merged with defaults before checking, so `{ cpu: { midUpperBound: 1 } }` is rejected because the default `lowUpperBound` (2) would exceed it.

```typescript
import { validateThresholds } from '@device-router/types';

// Throws: "Invalid thresholds: cpu.lowUpperBound (10) must be less than cpu.midUpperBound (2)"
validateThresholds({ cpu: { lowUpperBound: 10, midUpperBound: 2 } });
```

### `isBotSignals(signals: RawSignals): boolean`

Detects bot, crawler, and headless browser probe submissions. Returns `true` if any of:

- `signals.userAgent` matches known bot/crawler patterns (Googlebot, Bingbot, HeadlessChrome, Puppeteer, curl, etc.)
- `signals.gpuRenderer` matches headless GPU renderers (SwiftShader, llvmpipe, Software Rasterizer)
- All substantive signals (`viewport`, `hardwareConcurrency`, `deviceMemory`, `userAgent`) are `undefined`

Used internally by probe endpoints when `rejectBots: true` (the default). Can also be called directly:

```typescript
import { isBotSignals } from '@device-router/types';

if (isBotSignals(signals)) {
  // reject or flag this submission
}
```

### `classifyFromHeaders(headers): DeviceTiers`

Classifies device capabilities from HTTP request headers (User-Agent and Client Hints). Useful for first-request classification before the probe has run.

```typescript
import { classifyFromHeaders } from '@device-router/types';

const tiers = classifyFromHeaders({
  'user-agent': req.headers['user-agent'],
  'sec-ch-ua-mobile': req.headers['sec-ch-ua-mobile'],
  'device-memory': req.headers['device-memory'],
  'save-data': req.headers['save-data'],
});
// Mobile UA → { cpu: 'low', memory: 'low', connection: '4g', gpu: 'mid' }
// Tablet UA → { cpu: 'mid', memory: 'mid', connection: '4g', gpu: 'mid' }
// Desktop UA → { cpu: 'high', memory: 'high', connection: 'high', gpu: 'mid' }
```

Client Hints refine the base classification when present:

- `Device-Memory` overrides the memory tier directly
- `Save-Data: on` forces connection to `'3g'`
- `Sec-CH-UA-Mobile: ?1` forces mobile classification

### `resolveFallback(fallback: FallbackProfile): ClassifiedProfile`

Resolves a fallback profile specification into a full `ClassifiedProfile` with `source: 'fallback'`.

```typescript
import { resolveFallback } from '@device-router/types';

const profile = resolveFallback('conservative');
// { profile: {...}, tiers: { cpu: 'low', ... }, hints: {...}, source: 'fallback' }
```

Accepts `'conservative'`, `'optimistic'`, or a custom `DeviceTiers` object.

## Constants

### `CONSERVATIVE_TIERS`

Preset `DeviceTiers` for a conservative (low-end) assumption: `{ cpu: 'low', memory: 'low', connection: '3g', gpu: 'low' }`.

### `OPTIMISTIC_TIERS`

Preset `DeviceTiers` for an optimistic (high-end) assumption: `{ cpu: 'high', memory: 'high', connection: 'high', gpu: 'mid' }`.

### `ACCEPT_CH_VALUE`

The `Accept-CH` header value used to request Client Hints from the browser: `'Sec-CH-UA-Mobile, Sec-CH-UA-Platform, Device-Memory, Save-Data'`.

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

### GpuThresholds

| Field             | Type     | Default                                                   | Description                      |
| ----------------- | -------- | --------------------------------------------------------- | -------------------------------- |
| `softwarePattern` | `RegExp` | `/SwiftShader\|llvmpipe\|Software Rasterizer/i`           | Renderer matches → `'low'` tier  |
| `highEndPattern`  | `RegExp` | `/\bRTX\b\|Radeon RX [5-9]\d{3}\|Radeon Pro\|Apple M\d/i` | Renderer matches → `'high'` tier |

### Example

```typescript
import { classify } from '@device-router/types';

const tiers = classify(signals, {
  cpu: { lowUpperBound: 4, midUpperBound: 8 },
  memory: { midUpperBound: 8 },
  connection: { downlink4gUpperBound: 10 },
  gpu: { highEndPattern: /\bRTX\b|\bGTX\b/i },
});
```

## Types

### `ProfileSource`

```typescript
type ProfileSource = 'probe' | 'headers' | 'fallback';
```

Indicates where the classified profile originated: `'probe'` from client-side signals, `'headers'` from UA/Client Hints, or `'fallback'` from a configured default.

### `FallbackProfile`

```typescript
type FallbackProfile = 'conservative' | 'optimistic' | DeviceTiers;
```

Specifies the fallback strategy for first requests. Use `'conservative'` for low-end defaults, `'optimistic'` for high-end defaults, or provide a custom `DeviceTiers` object.

### `GpuTier`

```typescript
type GpuTier = 'none' | 'low' | 'mid' | 'high';
```

See [Profile Schema Reference](../profile-schema.md) for full type definitions.

## Event Types

### `DeviceRouterEvent`

Discriminated union of observability events emitted by the middleware. Use the `type` field to narrow:

```typescript
type DeviceRouterEvent =
  | {
      type: 'profile:classify';
      sessionToken: string;
      tiers: DeviceTiers;
      hints: RenderingHints;
      source: ProfileSource;
      durationMs: number;
    }
  | { type: 'profile:store'; sessionToken: string; signals: RawSignals; durationMs: number }
  | { type: 'bot:reject'; sessionToken: string; signals: RawSignals }
  | { type: 'error'; error: unknown; phase: 'middleware' | 'endpoint'; sessionToken?: string };
```

### `OnEventCallback`

```typescript
type OnEventCallback = (event: DeviceRouterEvent) => void | Promise<void>;
```

Callback function passed via the `onEvent` option. May be sync or async — errors are swallowed to avoid disrupting request handling.

### `emitEvent(onEvent, event)`

Helper that invokes the callback with error isolation. Catches sync throws and swallows async rejections. Used internally by all middleware packages — you only need this if building custom integrations.

```typescript
import { emitEvent } from '@device-router/types';

emitEvent(onEvent, { type: 'profile:classify', ... });
```

See the [Observability guide](../observability.md) for usage examples.
