# DeviceRouter

**The server does the thinking. The client does the displaying.**

_Product Requirements Document · v1.1 · Open Source (MIT)_

|         |                                               |
| ------- | --------------------------------------------- |
| Status  | Draft                                         |
| Version | 1.1                                           |
| License | MIT — fully open source                       |
| Target  | Framework-agnostic (Node, Python, Go, PHP...) |
| Author  | Community — contributions welcome             |

---

## 1. Problem Statement

> The median webpage ships 558 KB of JavaScript. 44% of it is never executed. A mid-range Android parses JavaScript 25× slower than a development machine. React sites generate 431% more main-thread time on mobile than desktop. This is not an engineering trade-off. It is contempt through negligence.

The root cause is a flawed architectural assumption: that every device should receive the same response, and that the client should sort out what it can handle. This assumption was never stated explicitly — it simply became the default as SPAs and JavaScript-heavy frameworks dominated the industry.

The consequences are real and measurable:

- Heavy JS triggers sustained CPU load, which triggers thermal throttling, which slows the chip further — a feedback loop with no exit. Result: +146% frame defects on mid-range mobile devices. _(CatchJS 2024)_
- Per byte delivered, nothing drains a battery like JavaScript. Images and video route through dedicated hardware decoders. JavaScript demands the main CPU continuously: parsing, compiling, executing, garbage-collecting.
- A 500 KB bundle takes ~200 ms to parse on a MacBook Pro. On a throttled mid-range Android: ~5 seconds. The developer never sees this. The user lives with it. _(V8 Blog)_
- "Mobile First" in practice means: same application, smaller viewport. Same bundle. Same framework overhead. Shipped to a device with a fraction of the compute and a battery the size of a biscuit.

The scale of the problem becomes concrete when you look at the products everyone uses daily. The following are uncompressed JavaScript payload sizes, measured by Nikita Tonsky in 2024:

| Product  | Uncompressed JS Payload |
| -------- | ----------------------- |
| Slack    | 55 MB                   |
| LinkedIn | 31 MB                   |
| Gmail    | 20 MB                   |

A chat message is 100 bytes. The Slack client weighs 550,000 times more. This is the industry norm, not the exception.

The counter-proof already exists. HTMA (HTML Augmented — [htma.run](https://htma.run)) demonstrates that a fully reactive page with direct DOM mutation, no virtual DOM, no hydration, and no build step can be delivered in a single file of 8.8 KB gzipped — with a state-and-render round-trip of ~19 ms. The browser was always capable. The weight was never necessary.

DeviceRouter exists to fix the architectural assumption at the layer where it does the most damage: the server response pipeline.

---

## 2. Vision

DeviceRouter is an open-source framework-agnostic toolkit that inverts the current model. Instead of shipping everything and letting the client sort it out, DeviceRouter detects device capabilities once — server-side — and builds a response tailored precisely to what that device needs.

**The server does the thinking. The client does the displaying.**

This is not responsive design. Responsive design changes layout via CSS breakpoints — the same bundle still lands on every device. DeviceRouter changes what is sent at the response-building level: different asset bundles, different component complexity, different CSS scope, all determined before the first byte of HTML is written.

> DeviceRouter is free, open source (MIT), and maintained by the community. It will never have a paid tier. It exists because the web deserves better, not because it is a business opportunity.

---

## 3. Goals & Non-Goals

### Goals

- Provide a minimal, droppable capability probe (< 1 KB gzipped) that any web page can include.
- Provide server-side middleware adapters for major frameworks (Express, FastAPI, Laravel, Rails, Go net/http...) that read device profiles and expose capability context to the rendering layer.
- Provide a dashboard (self-hostable) showing real-world device distribution across a site's user base, with bundle cost breakdowns per device class.
- Provide a static analysis CLI that audits a JavaScript bundle and identifies code paths unreachable on mobile device profiles.
- Be genuinely framework-agnostic: the core specification and probe are language-independent; official adapters exist for common ecosystems; community adapters can be built against a documented interface.
- Be zero-dependency in the probe itself. The probe must not require a build step, a CDN, or a runtime framework.

### Non-Goals

- DeviceRouter is not a JavaScript framework and does not replace React, Vue, or any frontend library.
- DeviceRouter is not a CDN, edge network, or hosting platform.
- DeviceRouter does not make decisions about your content — it provides capability context; what you do with it is your choice.
- DeviceRouter does not enforce any particular rendering architecture. It is compatible with SSR, SSG, edge rendering, and traditional server-side templates.
- DeviceRouter will never collect user data centrally. All device profiles are stored in your own infrastructure.

---

## 4. User Stories

### Developer — Integration

- As a backend developer, I want to drop a single middleware into my existing Express/FastAPI/Rails app and immediately have access to a device capability object in my request context, so that I can make rendering decisions without rewriting my architecture.
- As a frontend developer, I want the capability probe to be a single script tag I can add to any HTML page, so that device profiling begins without a build step or framework dependency.
- As a developer deploying to the edge, I want the middleware to work as a standalone function with no framework coupling, so that I can use it in Cloudflare Workers or similar environments.

### Engineering Lead — Visibility

- As an engineering lead, I want to open a dashboard and see what devices my actual users are running — CPU tier, memory class, connection type — so that I can make informed decisions about what to invest in optimising.
- As an engineering lead, I want to see a breakdown of my JavaScript bundle cost expressed in estimated parse time per device class, so that the cost is expressed in terms my team can act on.
- As an engineering lead, I want to run a CLI audit on our bundle before a release and get a report of code paths that are unreachable on mobile device profiles, so that we can catch regressions before they ship.

### Contributor — Open Source

- As a contributor, I want a clearly documented middleware interface specification so that I can build an adapter for any language or framework without waiting for an official one.
- As a contributor, I want a test harness that lets me validate my adapter against the DeviceRouter specification, so that I can be confident in correctness before submitting.

---

## 5. Architecture Overview

DeviceRouter is composed of four independent modules that can be used separately or together.

### Module 1 — Capability Probe (Client)

A single JavaScript file, no dependencies, no build step. Included via a standard script tag. Collects a minimal set of device signals on first page load and sends them to a configurable endpoint. Subsequent requests include a session token; the server reads the stored profile without re-probing.

**Signals collected:**

- Hardware concurrency (CPU core count)
- Device memory (`navigator.deviceMemory`)
- Connection type and effective bandwidth (NetworkInformation API)
- User agent string (for OS and device class inference)
- Viewport dimensions and pixel density
- Preference signals: `prefers-reduced-motion`, `prefers-color-scheme`

**What is explicitly NOT collected:** IP address, precise location, any identifier that persists across sessions without consent. The probe is privacy-by-design.

**Target size:** < 1 KB gzipped. Stretch goal: < 500 bytes.

### Module 2 — Server Middleware

Language-specific adapters that sit in the request pipeline. On each incoming request, the middleware checks for a session token, retrieves the stored device profile, normalises it into a standard capability object, and attaches it to the request context.

The capability object exposes three abstraction levels:

- **Raw signals:** the actual values collected by the probe (e.g. `hardwareConcurrency: 4`).
- **Inferred tiers:** normalised classifications (`cpu: 'low' | 'mid' | 'high'`, `connection: '2g' | '3g' | '4g' | 'fast'`).
- **Rendering hints:** opinionated suggestions (`deferHeavyComponents: true`, `serveMinimalCSS: true`) derived from the tier data.

**Official adapters for v1:** Node.js / Express, Node.js / Fastify, Python / FastAPI, Python / Django, Go / net/http.

Community adapter specification published at launch. Any language or framework can implement it.

### Module 3 — Analytics Dashboard

A self-hostable web application (Docker image provided). Reads from your DeviceRouter storage backend (Redis or PostgreSQL) and visualises device distribution, connection class breakdown, and bundle cost estimates.

**Key views:**

- Device class heatmap: what percentage of your users fall into each CPU/memory/connection tier.
- Bundle cost per tier: your current JS bundle size expressed as estimated parse time across device classes.
- Trend over time: are your users' devices getting faster or slower relative to your bundle growth?
- Geography overlay: device class distribution by country or region.

The dashboard has no external dependencies. It does not phone home. All data stays in your infrastructure.

### Module 4 — Static Analysis CLI

A command-line tool that takes a JavaScript bundle (or a source directory with a bundler config) and produces a capability audit report. Dead code detection is genuinely hard; this module does not pretend otherwise. The approach is heuristic static analysis: the CLI builds a call graph from the bundle, maps browser API usage to device capability requirements, and flags code paths that depend on capabilities outside the target device tier. It will produce false negatives on heavily minified or dynamically-evaluated code. This is documented explicitly; the tool is a guide, not a guarantee.

**Capabilities:**

- **Dead code detection:** identifies code paths statically unreachable on a given device capability profile, using call graph analysis. Accuracy improves with source maps.
- **Bundle cost report:** parse time estimates per device class, derived from V8 benchmark data extrapolated to CPU tier classifications.
- **Regression detection:** CI mode exits non-zero if bundle cost for a given device tier exceeds a configurable threshold.
- **Diff mode:** compare two bundles (e.g. before/after a dependency update) and show cost delta per device tier.
- **Known limitation:** dynamically evaluated code (`eval`, `Function` constructor, dynamic import with variable paths) cannot be statically analysed. The CLI warns on detection of these patterns.

---

## 6. What DeviceRouter Is Not

The most common misreading of DeviceRouter will be: "isn't this just User-Agent sniffing?" It deserves a direct answer, not a footnote.

### Not User-Agent sniffing

User-Agent sniffing infers device capabilities from a browser string. It is unreliable (UA strings are easily spoofed and increasingly frozen by browsers), unmaintainable (device databases require constant updates), and coarse (the same UA string covers devices with wildly different real-world performance).

DeviceRouter measures actual device signals at runtime: hardware concurrency, device memory, network information, and pixel density. These are real values from the device itself. A UA string tells you what a browser claims to be. DeviceRouter tells you what the device can actually do.

### Not a JavaScript framework

DeviceRouter does not replace React, Vue, Svelte, or any frontend library. It does not touch the client rendering layer. It operates entirely in the server request pipeline and surfaces capability context to whatever rendering system you already use.

### Not responsive design

Responsive design changes visual layout via CSS breakpoints. The same HTML, the same JavaScript bundle, and the same component tree land on every device. DeviceRouter changes what is sent before the response is built. A low-tier device receives a structurally different response — fewer components, lighter CSS, deferred assets — not a rearranged version of the same one.

### Not a fingerprinting tool

DeviceRouter does not create persistent cross-session device identifiers. Profiles are scoped to a session token with a configurable TTL (default 24 hours). The probe collects no PII. It is designed to be operated within the bounds of GDPR without requiring explicit consent for the probe itself — see the Privacy section of Technical Requirements for the legal basis analysis.

### Not a hosted service

DeviceRouter is infrastructure you run. There is no cloud component, no data sent to a third party, no dependency on any external service. The dashboard is self-hostable. The storage backend is yours. If the project ceases to be maintained, every deployment already in production continues to function unchanged.

---

## 7. Technical Requirements

| Requirement        | Detail                                                                                                                                                                                                                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Probe size         | < 1 KB gzipped. Must parse and execute in < 5 ms on a low-tier Android.                                                                                                                                                                                                                          |
| Session storage    | Server-side only. Client holds only an opaque session token (no PII in client storage).                                                                                                                                                                                                          |
| Storage backends   | Redis (default), PostgreSQL, in-memory (for testing). Interface is pluggable.                                                                                                                                                                                                                    |
| Profile TTL        | Configurable. Default: 24 hours. Profiles expire and are re-collected on next visit.                                                                                                                                                                                                             |
| Middleware latency | Profile lookup must add < 1 ms to request processing time (Redis p99).                                                                                                                                                                                                                           |
| Framework coupling | Zero. Core specification is a documented JSON contract. Adapters are thin wrappers.                                                                                                                                                                                                              |
| Privacy / GDPR     | Signals collected are technical characteristics, not personal data under GDPR Art. 4(1). Lawful basis: legitimate interest (Art. 6(1)(f)). No consent banner required for the probe alone. Deployments combining DeviceRouter profiles with authenticated user data must conduct their own DPIA. |
| Profile schema     | Published as a versioned JSON Schema. All adapters must read and write to this schema. Schema version is included in every stored profile. Breaking changes require a major version bump and a documented migration path.                                                                        |
| License            | MIT. No CLA required for contributions.                                                                                                                                                                                                                                                          |
| Test coverage      | All modules require > 80% coverage. Middleware specification includes a conformance test suite.                                                                                                                                                                                                  |
| Documentation      | Every public API documented. Getting-started guide must achieve integration in < 15 minutes.                                                                                                                                                                                                     |

---

## 8. Sources

| Claim                                      | Source                                                                                                                 |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| 558 KB median JS, 44% never executed       | HTTP Archive 2024 — [httparchive.org/reports/state-of-javascript](https://httparchive.org/reports/state-of-javascript) |
| 25× slower JS parsing on mobile            | V8 Blog — [v8.dev/blog/cost-of-javascript-2019](https://v8.dev/blog/cost-of-javascript-2019)                           |
| 431% more main-thread time on React mobile | CatchJS 2024 — [catchjs.com/Blog/PerformanceInTheWild](https://catchjs.com/Blog/PerformanceInTheWild)                  |
| Slack 55 MB / LinkedIn 31 MB / Gmail 20 MB | Tonsky 2024 — [tonsky.me/blog/js-bloat/](https://tonsky.me/blog/js-bloat/)                                             |
| HTMA: 8.8 KB gzipped, ~19 ms round-trip    | [htma.run](https://htma.run) — [gitlab.com/min2max/htma](https://gitlab.com/min2max/htma)                              |

---

## 9. Release Milestones

| Milestone              | Scope                                                                           | Target    |
| ---------------------- | ------------------------------------------------------------------------------- | --------- |
| v0.1 — Probe Alpha     | Capability probe + Express middleware + Redis storage. No dashboard.            | Month 1–2 |
| v0.2 — Adapters        | FastAPI, Django, Go adapters. Conformance test suite published.                 | Month 2–3 |
| v0.3 — Dashboard Alpha | Self-hostable dashboard with device distribution and bundle cost views.         | Month 3–4 |
| v0.4 — CLI Alpha       | Static analysis CLI with dead code detection and bundle cost report.            | Month 4–5 |
| v1.0 — Stable          | All modules stable. Full documentation. Docker images. Community adapter guide. | Month 6   |

---

## 10. Success Metrics

DeviceRouter is not a business. There is no revenue metric. Success is measured by impact and adoption.

- GitHub stars are a vanity metric. The real signal is issues filed, PRs submitted, and community adapters built.
- A successful v1 is one where a developer can go from zero to a working capability-aware rendering layer in under 15 minutes, using only the documentation.
- A successful project is one where developers report measurably reduced JS parse time on low-tier devices after integrating DeviceRouter — and where those numbers are shared publicly.
- A successful community is one where the core team is not the bottleneck: community adapters exist for ecosystems the core team never touched.
- Long-term: DeviceRouter patterns influence how mainstream frameworks think about server-side capability detection — even if they never adopt DeviceRouter directly. The idea spreading matters more than the project being the one that spreads it.

---

## 11. Contributing

DeviceRouter is built in the open from day one. There is no private roadmap, no internal Slack, no decisions made behind closed doors. Everything happens on GitHub.

### How to Contribute

- Build an adapter for your language or framework. The specification is the contract; everything else is up to you.
- File issues for bugs, missing device signals, or documentation gaps.
- Improve the probe. If you can get it smaller or faster without losing signal quality, that is the single most impactful contribution possible.
- Test on real devices. Run the probe on the oldest Android you can find. File what breaks.
- Write about it. A case study showing before/after parse times on a real site is worth more than any marketing.

### Governance

DeviceRouter uses a simple governance model: decisions are made by maintainers through public discussion on GitHub. There are no hidden stakeholders. The project will never be acquired or commercialised without an explicit community vote. If it ever is, the MIT license ensures the community can fork it freely.

---

> The browser was always capable. We just buried it under abstractions built for developer convenience rather than user experience. DeviceRouter is an attempt to dig it back out — one request pipeline at a time.
