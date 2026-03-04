# Privacy

DeviceRouter collects device capability signals to classify devices and derive rendering hints.
This document summarizes what is collected, what is not, and where to find detailed guidance.

## What is collected

The client probe reads the following signals via browser APIs:

- CPU core count (`hardwareConcurrency`)
- Device memory (`deviceMemory`)
- Connection type, downlink speed, RTT, data saver mode (`navigator.connection`)
- Pixel ratio (`devicePixelRatio`)
- Prefers reduced motion / color scheme (`matchMedia`)
- GPU renderer (WebGL debug info)
- Battery level and charging status (`navigator.getBattery()`)

All signals are optional — the probe gracefully degrades based on what the browser supports.

## What is NOT stored

- **User agent** — collected for bot/crawler filtering, then stripped before storage
- **Viewport dimensions** — collected for bot/crawler filtering, then stripped before storage

These two fields never reach the storage layer.

## Cookie

DeviceRouter sets a single session cookie:

| Attribute  | Value                   |
| ---------- | ----------------------- |
| Name       | `device-router-session` |
| `httpOnly` | `true`                  |
| `sameSite` | `lax`                   |
| `secure`   | `false` (configurable)  |
| `path`     | `/` (configurable)      |
| Max age    | 24 hours (configurable) |

The cookie value is a random UUID v4 (`crypto.randomUUID()`). It contains no user data — it is
solely a key to look up the stored device profile.

## No tracking, no profiling

- Profiles are tied to random session tokens, not to users or accounts
- No data is shared with third parties
- No cross-session or cross-site tracking
- No personally identifiable information (PII) is collected or stored

## Regulatory implications

Depending on your jurisdiction, collecting device signals and setting a cookie may require user
consent. DeviceRouter provides the technical building blocks but does **not** include a consent
mechanism — that is your responsibility.

For detailed regulatory guidance (GDPR, ePrivacy, CCPA, LGPD) and consent integration examples,
see the [Privacy Guide](docs/privacy.md).

---

> **Disclaimer:** This document is informational guidance, not legal advice. Consult a qualified
> privacy professional for your specific deployment.
