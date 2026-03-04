# Privacy Guide

DeviceRouter collects browser signals, classifies devices, and stores profiles linked to a session
cookie. This guide covers exactly what data flows through the system, how it is stored, the
fingerprinting implications, and how to integrate consent mechanisms.

## Signal Inventory

The probe collects these signals via browser APIs. Signals marked "Stored" are persisted in the
storage adapter; the rest are used during probe submission and discarded.

| Signal                 | Browser API                       | Stored | Fingerprinting risk |
| ---------------------- | --------------------------------- | ------ | ------------------- |
| CPU core count         | `hardwareConcurrency`             | Yes    | Low                 |
| Device memory          | `deviceMemory`                    | Yes    | Low                 |
| Connection type        | `navigator.connection`            | Yes    | Low                 |
| Downlink speed         | `navigator.connection`            | Yes    | Low                 |
| Round-trip time (RTT)  | `navigator.connection`            | Yes    | Low                 |
| Data saver mode        | `navigator.connection`            | Yes    | Low                 |
| Pixel ratio            | `devicePixelRatio`                | Yes    | Medium              |
| Prefers reduced motion | `matchMedia`                      | Yes    | Low                 |
| Prefers color scheme   | `matchMedia`                      | Yes    | Low                 |
| GPU renderer           | WebGL `WEBGL_debug_renderer_info` | Yes    | High                |
| Battery level          | `navigator.getBattery()`          | Yes    | Medium              |
| Battery charging       | `navigator.getBattery()`          | Yes    | Low                 |
| User agent             | `navigator.userAgent`             | **No** | High                |
| Viewport dimensions    | `window.innerWidth/Height`        | **No** | Medium              |

All signals are optional — the probe gracefully degrades when a browser API is unavailable.

### Fingerprinting risk ratings

- **High** — GPU renderer strings and user agents are well-known fingerprinting vectors. The
  combination of these with other signals can narrow down device identity significantly.
- **Medium** — Pixel ratio and battery level add entropy when combined with other signals but are
  low-risk in isolation.
- **Low** — Values like CPU core count or connection type have limited cardinality and contribute
  minimal fingerprinting entropy on their own.

## What Gets Stripped

`userAgent` and `viewport` are collected by the probe but **stripped before storage**. The endpoint
destructures them out before building the stored profile:

```typescript
const { userAgent: _userAgent, viewport: _viewport, ...storedSignals } = signals;
```

This is enforced at the type level:

```typescript
type StoredSignals = Omit<RawSignals, 'userAgent' | 'viewport'>;
```

**Why collect them at all?** Both are used for bot/crawler detection (`isBotSignals()`) at the probe
endpoint. Once bot filtering is complete, they are discarded.

## Cookie Details

DeviceRouter sets a single session cookie per visitor.

| Attribute  | Default value             | Configurable          |
| ---------- | ------------------------- | --------------------- |
| Name       | `device-router-session`   | `cookieName` option   |
| `httpOnly` | `true`                    | No (hardcoded)        |
| `sameSite` | `lax`                     | No (hardcoded)        |
| `secure`   | `false`                   | `cookieSecure` option |
| `path`     | `/`                       | `cookiePath` option   |
| Max age    | 86 400 seconds (24 hours) | `ttl` option          |

**Security notes:**

- `httpOnly: true` prevents client-side JavaScript from reading the cookie value
- `sameSite: lax` prevents the cookie from being sent on cross-origin requests
- Set `cookieSecure: true` in production to restrict the cookie to HTTPS

## Session ID

Session tokens are UUID v4 values generated via `crypto.randomUUID()` (Node.js) or
`globalThis.crypto.randomUUID()` (Hono/edge runtimes). They are:

- Cryptographically random (122 bits of entropy)
- Not derived from any user data
- Not sequential or predictable
- Used solely as a storage key to retrieve the device profile

If a valid session cookie already exists, the existing token is reused — no new UUID is generated.

## Storage and Data Retention

### MemoryStorageAdapter

- Profiles are stored in a `Map` with a `setTimeout` for automatic expiration
- When the TTL expires, the entry is deleted from memory
- The timer is `unref()`'d so it does not prevent Node.js from exiting
- A passive expiry check on `get()` ensures stale entries are caught even if the timer fires late

### RedisStorageAdapter

- Profiles are stored as JSON strings with the Redis `EX` flag for native key expiration
- Keys use a configurable prefix (default: `dr:profile:`) prepended to the session token
- When `scan()` is available on the Redis client, non-blocking `SCAN` is used instead of `KEYS`

### TTL configuration

The default TTL is 86 400 seconds (24 hours), configurable via the `ttl` option on
`createDeviceRouter()` or `createProbeEndpoint()`. Shorter TTLs reduce the window during which
stored profiles exist and limit regulatory exposure.

### Data management methods

Both storage adapters implement these methods for managing stored data:

| Method     | Description                                  |
| ---------- | -------------------------------------------- |
| `get()`    | Retrieve a profile by session token          |
| `delete()` | Delete a specific profile by session token   |
| `clear()`  | Delete all stored profiles                   |
| `keys()`   | List all session tokens (without key prefix) |
| `count()`  | Return the number of stored profiles         |
| `exists()` | Check whether a profile exists for a token   |

## Fingerprinting Risk Assessment

While DeviceRouter uses signals for adaptive rendering — not identification — regulators evaluate
the **capability** of the data to identify users, not just the stated intent.

### High-risk combinations

The following signal combinations, when present together, can significantly narrow down device
identity:

- **GPU renderer + hardware concurrency + device memory** — Together these can distinguish specific
  device models with moderate confidence
- **GPU renderer + pixel ratio + battery level** — On mobile devices, this combination provides
  relatively high entropy

### Risk mitigation

- **Strip what you do not need.** If your application only needs CPU and memory tiers, you do not
  need to store `gpuRenderer` or `battery`. The probe collects all available signals, but you can
  post-process or filter before classification.
- **Shorten TTL.** Shorter sessions reduce the time window for potential correlation.
- **Avoid combining with other identifiers.** Do not link device profiles with user accounts,
  analytics IDs, or other tracking mechanisms.

## Regulatory Guidance

### EU: GDPR and ePrivacy Directive

Two regulations apply independently:

- **ePrivacy Directive (Article 5(3))** covers both setting the `device-router-session` cookie _and_
  reading device signals from browser APIs. Both count as accessing information stored on terminal
  equipment. The "strictly necessary" exemption is interpreted narrowly by the EDPB, CNIL, and
  ICO — it requires that the service _cannot function_ without the data, not that it functions
  _better_ with it. Adaptive rendering has not been recognized as strictly necessary by any
  regulator.

- **GDPR** applies because the collected signals in aggregate constitute personal data (Recital 30
  explicitly references device identifiers and the profiles they can create). You need a lawful basis
  under Article 6 — consent (Article 6(1)(a)) is the most defensible option.

**In practice:** implement a cookie consent mechanism before deploying DeviceRouter in the EU.

### UK (PECR)

The UK GDPR and PECR follow the same framework as the EU. The ICO has been particularly vocal about
fingerprinting-like techniques — treat the requirements as equivalent.

### California (CCPA/CPRA)

The collected signals qualify as personal information under CCPA. You must:

- Disclose the collection in your privacy notice (notice at collection)
- Honor access and deletion requests for stored profiles
- If you never sell or share the data with third parties, the "Do Not Sell" opt-out does not apply,
  but the data is still subject to consumer rights

### Brazil (LGPD)

The ANPD treats cookie and fingerprinting data as personal data. Consent must be "free, informed and
unequivocal." There is no "strictly necessary" carve-out equivalent to the ePrivacy Directive.

## Consent Integration

Load the probe script only after the user has given consent. This ensures no signals are collected
and no cookies are set without permission.

### Example: conditional probe loading

```html
<script>
  document.addEventListener('cookie-consent-granted', function () {
    var script = document.createElement('script');
    script.src = '/device-router/probe.min.js';
    document.head.appendChild(script);
  });
</script>
```

### Example: conditional auto-injection

If you use the `injectProbe` option, gate the middleware behind your consent check:

```typescript
import { createDeviceRouter } from '@device-router/middleware-express';

const { middleware, probeEndpoint, injectionMiddleware } = createDeviceRouter({
  storage,
  injectProbe: true,
});

// Only inject the probe for users who have consented
app.use((req, res, next) => {
  if (req.cookies['cookie-consent'] === 'accepted') {
    return injectionMiddleware(req, res, next);
  }
  next();
});
```

### Example: server-side consent check on probe endpoint

```typescript
app.post('/device-router/probe', (req, res, next) => {
  if (req.cookies['cookie-consent'] !== 'accepted') {
    return res.status(403).json({ error: 'Consent required' });
  }
  probeEndpoint(req, res, next);
});
```

## Data Subject Rights

### Access requests

Retrieve a stored profile using the session token from the cookie:

```typescript
const sessionToken = req.cookies['device-router-session'];
if (sessionToken) {
  const profile = await storage.get(sessionToken);
  // Return profile data to the user
}
```

### Deletion requests

Delete a specific profile and clear the cookie:

```typescript
const sessionToken = req.cookies['device-router-session'];
if (sessionToken) {
  await storage.delete(sessionToken);
  res.clearCookie('device-router-session');
}
```

### Bulk operations

For administrative purposes, you can list or clear all stored profiles:

```typescript
const count = await storage.count(); // Number of stored profiles
const tokens = await storage.keys(); // All session tokens
await storage.clear(); // Delete all profiles
```

## Bot Filtering

When `rejectBots: true` (the default), the probe endpoint checks incoming submissions for bot
signals before processing. Bot-detected requests receive an HTTP 403 response and **no profile is
stored**.

Detection covers:

- Known bot/crawler user agent patterns (Googlebot, ChatGPT, Puppeteer, etc.)
- Headless GPU renderers (SwiftShader, LLVMpipe, Software Rasterizer)
- Empty signal payloads (no viewport, CPU, memory, or user agent)

Since bot submissions are rejected before storage, no data retention or privacy considerations apply
to bot traffic.

---

> **Disclaimer:** This guide is informational guidance, not legal advice. Consult a qualified
> privacy professional for your specific deployment.
