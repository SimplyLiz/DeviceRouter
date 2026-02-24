# Profile Schema Reference

The device profile follows a versioned JSON Schema (`schemas/device-profile.v1.json`).

## DeviceProfile

| Field           | Type                | Description                      |
| --------------- | ------------------- | -------------------------------- |
| `schemaVersion` | `1`                 | Schema version (always 1 for v1) |
| `sessionToken`  | `string`            | Unique session identifier        |
| `createdAt`     | `string` (ISO 8601) | When the profile was created     |
| `expiresAt`     | `string` (ISO 8601) | When the profile expires         |
| `signals`       | `RawSignals`        | Collected device signals         |

## RawSignals

All fields are optional — the probe collects what it can based on browser API availability.

> **Note:** The probe also collects `userAgent` and `viewport` for bot/crawler filtering, but they are stripped before the profile is stored.

| Field                  | Type                                   | Description                        |
| ---------------------- | -------------------------------------- | ---------------------------------- |
| `hardwareConcurrency`  | `number`                               | Logical CPU cores                  |
| `deviceMemory`         | `number`                               | Approximate device memory in GB    |
| `connection`           | `ConnectionInfo`                       | Network connection info            |
| `pixelRatio`           | `number`                               | Device pixel ratio                 |
| `prefersReducedMotion` | `boolean`                              | Prefers reduced motion media query |
| `prefersColorScheme`   | `'light' \| 'dark' \| 'no-preference'` | Color scheme preference            |
| `gpuRenderer`          | `string`                               | WebGL unmasked renderer string     |
| `battery`              | `{ level: number; charging: boolean }` | Battery status (Chromium only)     |

## ConnectionInfo

| Field           | Type                                | Description               |
| --------------- | ----------------------------------- | ------------------------- |
| `effectiveType` | `'slow-2g' \| '2g' \| '3g' \| '4g'` | Effective connection type |
| `downlink`      | `number`                            | Downlink speed in Mbps    |
| `rtt`           | `number`                            | Round-trip time in ms     |
| `saveData`      | `boolean`                           | Data saver mode enabled   |

## DeviceTiers (derived)

| Field        | Values                               | Description                        |
| ------------ | ------------------------------------ | ---------------------------------- |
| `cpu`        | `'low' \| 'mid' \| 'high'`           | CPU tier based on core count       |
| `memory`     | `'low' \| 'mid' \| 'high'`           | Memory tier based on device memory |
| `connection` | `'2g' \| '3g' \| '4g' \| 'high'`     | Connection tier                    |
| `gpu`        | `'none' \| 'low' \| 'mid' \| 'high'` | GPU tier based on renderer string  |

## ClassifiedProfile (derived)

The full classified result attached to requests by the middleware.

| Field     | Type             | Description                                     |
| --------- | ---------------- | ----------------------------------------------- |
| `profile` | `DeviceProfile`  | Raw profile with signals                        |
| `tiers`   | `DeviceTiers`    | Classified capability tiers                     |
| `hints`   | `RenderingHints` | Boolean rendering decisions                     |
| `source`  | `ProfileSource`  | Origin: `'probe'`, `'headers'`, or `'fallback'` |

### ProfileSource

| Value        | Description                                                |
| ------------ | ---------------------------------------------------------- |
| `'probe'`    | Profile from client-side probe signals (stored in session) |
| `'headers'`  | Classified from UA and Client Hints on first request       |
| `'fallback'` | Resolved from configured fallback defaults                 |

## RenderingHints (derived)

| Field                   | Type      | When `true`                                            |
| ----------------------- | --------- | ------------------------------------------------------ |
| `deferHeavyComponents`  | `boolean` | Low-end device, slow connection, or low battery        |
| `serveMinimalCSS`       | `boolean` | Low-end device                                         |
| `reduceAnimations`      | `boolean` | Low-end device, prefers reduced motion, or low battery |
| `useImagePlaceholders`  | `boolean` | Slow connection (2g/3g)                                |
| `preferServerRendering` | `boolean` | Low-end device                                         |
| `disable3dEffects`      | `boolean` | No GPU or software renderer                            |
