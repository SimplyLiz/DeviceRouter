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

| Field                  | Type                                   | Description                        |
| ---------------------- | -------------------------------------- | ---------------------------------- |
| `hardwareConcurrency`  | `number`                               | Logical CPU cores                  |
| `deviceMemory`         | `number`                               | Approximate device memory in GB    |
| `connection`           | `ConnectionInfo`                       | Network connection info            |
| `userAgent`            | `string`                               | Navigator user agent string        |
| `viewport`             | `Viewport`                             | Viewport dimensions                |
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

## Viewport

| Field    | Type     | Description          |
| -------- | -------- | -------------------- |
| `width`  | `number` | Width in CSS pixels  |
| `height` | `number` | Height in CSS pixels |

## DeviceTiers (derived)

| Field        | Values                               | Description                        |
| ------------ | ------------------------------------ | ---------------------------------- |
| `cpu`        | `'low' \| 'mid' \| 'high'`           | CPU tier based on core count       |
| `memory`     | `'low' \| 'mid' \| 'high'`           | Memory tier based on device memory |
| `connection` | `'2g' \| '3g' \| '4g' \| 'fast'`     | Connection tier                    |
| `gpu`        | `'none' \| 'low' \| 'mid' \| 'high'` | GPU tier based on renderer string  |

## RenderingHints (derived)

| Field                   | Type      | When `true`                                            |
| ----------------------- | --------- | ------------------------------------------------------ |
| `deferHeavyComponents`  | `boolean` | Low-end device, slow connection, or low battery        |
| `serveMinimalCSS`       | `boolean` | Low-end device                                         |
| `reduceAnimations`      | `boolean` | Low-end device, prefers reduced motion, or low battery |
| `useImagePlaceholders`  | `boolean` | Slow connection (2g/3g)                                |
| `disableAutoplay`       | `boolean` | Low-end device, slow connection, or low battery        |
| `preferServerRendering` | `boolean` | Low-end device                                         |
| `disable3dEffects`      | `boolean` | No GPU or software renderer                            |
