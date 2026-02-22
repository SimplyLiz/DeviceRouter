# @device-router/probe API

## Script Tag Usage

Include the pre-built IIFE script in your HTML:

```html
<script src="/device-router-probe.min.js"></script>
```

The script automatically runs on load, collecting device signals and POSTing them to `/device-router/probe`.

## Programmatic Usage

```typescript
import { runProbe } from '@device-router/probe';

await runProbe({
  endpoint: '/device-router/probe', // POST endpoint
  cookieName: 'dr_session', // Session cookie name
  cookiePath: '/', // Cookie path
});
```

## Functions

### `runProbe(options?: ProbeOptions): Promise<void>`

Collects device signals and submits them to the server. Skips if session cookie already exists.

### `collectSignals(): ProbeSignals`

Collects all available device signals from browser APIs. Returns an object with optional fields based on API availability.

## Collected Signals

| Signal                 | Browser API                     | Availability        |
| ---------------------- | ------------------------------- | ------------------- |
| `hardwareConcurrency`  | `navigator.hardwareConcurrency` | All modern browsers |
| `deviceMemory`         | `navigator.deviceMemory`        | Chrome, Edge        |
| `connection`           | `navigator.connection`          | Chrome, Edge        |
| `userAgent`            | `navigator.userAgent`           | All browsers        |
| `viewport`             | `window.innerWidth/Height`      | All browsers        |
| `pixelRatio`           | `window.devicePixelRatio`       | All browsers        |
| `prefersReducedMotion` | `matchMedia`                    | All modern browsers |
| `prefersColorScheme`   | `matchMedia`                    | All modern browsers |

## Build Output

- `dist/device-router-probe.min.js` — Minified IIFE bundle (<1 KB gzipped)
