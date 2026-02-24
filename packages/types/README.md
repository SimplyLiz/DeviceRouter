# @device-router/types

Type definitions, device classification, and rendering hint derivation for [DeviceRouter](https://github.com/SimplyLiz/DeviceRouter).

## Installation

```bash
pnpm add @device-router/types
```

## Usage

### Classify device signals into tiers

```typescript
import { classify } from '@device-router/types';

const tiers = classify({
  hardwareConcurrency: 8,
  deviceMemory: 8,
  connection: { effectiveType: '4g', downlink: 50 },
  gpuRenderer: 'ANGLE (Apple, Apple M2 Pro, OpenGL 4.1)',
});
// { cpu: 'high', memory: 'high', connection: 'high', gpu: 'high' }
```

### Derive rendering hints

```typescript
import { classify, deriveHints } from '@device-router/types';

const tiers = classify(signals);
const hints = deriveHints(tiers, signals);
// {
//   deferHeavyComponents: false,
//   serveMinimalCSS: false,
//   reduceAnimations: false,
//   useImagePlaceholders: false,
//   disableAutoplay: false,
//   preferServerRendering: false,
//   disable3dEffects: false,
// }
```

Rendering hints are derived from tiers and transient signals:

| Hint                    | When `true`                                            |
| ----------------------- | ------------------------------------------------------ |
| `deferHeavyComponents`  | Low-end device, slow connection, or low battery        |
| `serveMinimalCSS`       | Low-end device                                         |
| `reduceAnimations`      | Low-end device, prefers reduced motion, or low battery |
| `useImagePlaceholders`  | Slow connection (2G/3G)                                |
| `disableAutoplay`       | Low-end device, slow connection, or low battery        |
| `preferServerRendering` | Low-end device                                         |
| `disable3dEffects`      | No GPU or software renderer                            |

The `battery` signal bypasses tier classification — it's transient state, not a capability. When unplugged and below 15% charge, power-sensitive hints are forced on.

### Custom thresholds

Override default tier boundaries:

```typescript
import { classify } from '@device-router/types';

const tiers = classify(signals, {
  cpu: { lowUpperBound: 4, midUpperBound: 8 },
  memory: { midUpperBound: 8 },
  connection: { downlink4gUpperBound: 10 },
  gpu: { highEndPattern: /\bRTX\b|\bGTX\b/i },
});
```

### Validate thresholds

Thresholds are validated automatically by `createDeviceRouter()`. For standalone usage with `classify()`, call `validateThresholds()` explicitly:

```typescript
import { validateThresholds } from '@device-router/types';

validateThresholds({
  cpu: { lowUpperBound: 4, midUpperBound: 8 },
}); // OK

validateThresholds({
  cpu: { lowUpperBound: 10, midUpperBound: 2 },
}); // throws Error
```

### Validate incoming signals

```typescript
import { isValidSignals } from '@device-router/types';

if (isValidSignals(requestBody)) {
  // requestBody is typed as RawSignals
}
```

## Tier classification

| Dimension      | Low               | Mid          | High/Fast                     |
| -------------- | ----------------- | ------------ | ----------------------------- |
| **CPU**        | 1-2 cores         | 3-4 cores    | 5+ cores                      |
| **Memory**     | <=2 GB            | 2-4 GB       | >4 GB                         |
| **Connection** | 2G                | 3G / slow 4G | 4G+ (>=5 Mbps)                |
| **GPU**        | Software renderer | Mid-range    | RTX, RX 5000+, Apple M-series |

## Exports

### Functions

- `classify(signals, thresholds?)` — Classify raw signals into `DeviceTiers`
- `classifyCpu(hardwareConcurrency?, thresholds?)` — CPU tier
- `classifyMemory(deviceMemory?, thresholds?)` — Memory tier
- `classifyConnection(effectiveType?, downlink?, thresholds?)` — Connection tier
- `classifyGpu(renderer?, thresholds?)` — GPU tier
- `deriveHints(tiers, signals?)` — Derive `RenderingHints` from tiers and signals
- `validateThresholds(thresholds)` — Validate custom thresholds (called automatically by middleware)
- `isValidSignals(body)` — Type guard for `RawSignals`
- `isBotSignals(signals)` — Detect bot/crawler/headless browser probe submissions
- `classifyFromHeaders(headers)` — Classify from UA/Client Hints headers
- `resolveFallback(fallback)` — Resolve a fallback profile preset or custom tiers

### Constants

- `CONSERVATIVE_TIERS` — Low-end device tier preset
- `OPTIMISTIC_TIERS` — High-end device tier preset
- `ACCEPT_CH_VALUE` — `Accept-CH` header value for requesting Client Hints

### Types

- `RawSignals` — Browser-collected device signals
- `DeviceTiers` — Classified capability tiers (`cpu`, `memory`, `connection`, `gpu`)
- `RenderingHints` — Boolean rendering decisions
- `DeviceProfile` — Full profile with schema version, session token, timestamps, and signals
- `ClassifiedProfile` — Profile + tiers + hints + source
- `ProfileSource` — `'probe' | 'headers' | 'fallback'`
- `FallbackProfile` — `'conservative' | 'optimistic' | DeviceTiers`
- `TierThresholds` — Custom threshold configuration
- `CpuTier`, `MemoryTier`, `ConnectionTier`, `GpuTier` — Individual tier types

## License

MIT
