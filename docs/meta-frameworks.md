# Meta-Framework Integration

DeviceRouter's middleware packages target traditional Node.js servers (Express, Fastify, Hono, Koa). Meta-frameworks like Next.js, Remix, and SvelteKit run middleware at the edge or inside server functions — a different execution model where the full middleware stack isn't available.

The solution: use `classifyFromHeaders` and `deriveHints` directly from `@device-router/types`. No middleware package needed.

## Common Pattern

All three frameworks follow the same two-phase approach:

1. **First request** — classify from HTTP headers using `classifyFromHeaders`. Less accurate (relies on User-Agent and Chromium Client Hints), but immediate.
2. **Subsequent requests** — the probe script runs client-side, POSTs signals to a custom API route, and stores the full profile. Future requests get probe-based classification.

Only one dependency is required:

```bash
pnpm add @device-router/types
```

## Next.js (App Router)

### Middleware classification

Next.js middleware runs before every request. Use it to classify from headers and pass tiers downstream via request headers.

```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { classifyFromHeaders, deriveHints, ACCEPT_CH_VALUE } from '@device-router/types';

export function middleware(request: NextRequest) {
  const tiers = classifyFromHeaders({
    'user-agent': request.headers.get('user-agent') ?? undefined,
    'sec-ch-ua-mobile': request.headers.get('sec-ch-ua-mobile') ?? undefined,
    'device-memory': request.headers.get('device-memory') ?? undefined,
    'save-data': request.headers.get('save-data') ?? undefined,
  });

  const hints = deriveHints(tiers);

  const response = NextResponse.next();

  // Pass tiers and hints to server components via request headers
  response.headers.set('x-device-tiers', JSON.stringify(tiers));
  response.headers.set('x-device-hints', JSON.stringify(hints));

  // Request Client Hints from Chromium browsers on subsequent requests
  response.headers.set('Accept-CH', ACCEPT_CH_VALUE);

  return response;
}
```

### Reading tiers in server components

```typescript
// app/page.tsx
import { headers } from 'next/headers';
import type { DeviceTiers, RenderingHints } from '@device-router/types';

export default async function Page() {
  const headerStore = await headers();
  const tiers: DeviceTiers = JSON.parse(headerStore.get('x-device-tiers') ?? '{}');
  const hints: RenderingHints = JSON.parse(headerStore.get('x-device-hints') ?? '{}');

  return (
    <main>
      {hints.preferServerRendering ? <LitePage /> : <FullPage />}
    </main>
  );
}
```

### Adding the probe for full accuracy

The probe still runs client-side for full accuracy on subsequent requests. Add a probe API route and include the probe script in your layout:

```typescript
// app/api/device-router/probe/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { isValidSignals, classify, deriveHints } from '@device-router/types';

export async function POST(request: NextRequest) {
  const body = await request.json();

  if (!isValidSignals(body)) {
    return NextResponse.json({ error: 'Invalid signals' }, { status: 400 });
  }

  const tiers = classify(body);
  const hints = deriveHints(tiers);

  // Store in your preferred storage (cookie, KV, database, etc.)
  const response = NextResponse.json({ ok: true });
  response.cookies.set('dr_tiers', JSON.stringify(tiers), {
    httpOnly: true,
    secure: true,
    maxAge: 86400,
  });

  return response;
}
```

## Remix

### Loader classification

Use `classifyFromHeaders` in a Remix loader to classify on the server and pass tiers as loader data.

```typescript
// app/routes/_index.tsx
import type { LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { classifyFromHeaders, deriveHints, ACCEPT_CH_VALUE } from '@device-router/types';
import type { DeviceTiers, RenderingHints } from '@device-router/types';

export function loader({ request }: LoaderFunctionArgs) {
  const headers = request.headers;

  const tiers = classifyFromHeaders({
    'user-agent': headers.get('user-agent') ?? undefined,
    'sec-ch-ua-mobile': headers.get('sec-ch-ua-mobile') ?? undefined,
    'device-memory': headers.get('device-memory') ?? undefined,
    'save-data': headers.get('save-data') ?? undefined,
  });

  const hints = deriveHints(tiers);

  return json(
    { tiers, hints },
    { headers: { 'Accept-CH': ACCEPT_CH_VALUE } },
  );
}

export default function Index() {
  const { tiers, hints } = useLoaderData<typeof loader>();

  return (
    <main>
      {hints.preferServerRendering ? <LitePage /> : <FullPage />}
      <p>CPU tier: {tiers.cpu}</p>
    </main>
  );
}
```

### Adding the probe

Add the probe script via a `<script>` tag in your root layout. Create a resource route to handle probe submissions:

```typescript
// app/routes/device-router.probe.tsx
import type { ActionFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { isValidSignals, classify, deriveHints } from '@device-router/types';

export async function action({ request }: ActionFunctionArgs) {
  const body = await request.json();

  if (!isValidSignals(body)) {
    return json({ error: 'Invalid signals' }, { status: 400 });
  }

  const tiers = classify(body);
  const hints = deriveHints(tiers);

  // Store tiers — cookie, session, database, etc.
  return json(
    { ok: true },
    {
      headers: {
        'Set-Cookie': `dr_tiers=${JSON.stringify(tiers)}; HttpOnly; Secure; Max-Age=86400`,
      },
    },
  );
}
```

## SvelteKit

### Server hook classification

Use `hooks.server.ts` to classify on every request and attach tiers to `event.locals`.

```typescript
// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit';
import { classifyFromHeaders, deriveHints, ACCEPT_CH_VALUE } from '@device-router/types';

export const handle: Handle = async ({ event, resolve }) => {
  const tiers = classifyFromHeaders({
    'user-agent': event.request.headers.get('user-agent') ?? undefined,
    'sec-ch-ua-mobile': event.request.headers.get('sec-ch-ua-mobile') ?? undefined,
    'device-memory': event.request.headers.get('device-memory') ?? undefined,
    'save-data': event.request.headers.get('save-data') ?? undefined,
  });

  const hints = deriveHints(tiers);

  event.locals.deviceTiers = tiers;
  event.locals.deviceHints = hints;

  const response = await resolve(event);
  response.headers.set('Accept-CH', ACCEPT_CH_VALUE);

  return response;
};
```

### Using tiers in page loads

```typescript
// src/routes/+page.server.ts
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  return {
    tiers: locals.deviceTiers,
    hints: locals.deviceHints,
  };
};
```

```svelte
<!-- src/routes/+page.svelte -->
<script lang="ts">
  export let data;
</script>

{#if data.hints.preferServerRendering}
  <LitePage />
{:else}
  <FullPage />
{/if}
```

### Adding the probe

Create a server endpoint for probe submissions:

```typescript
// src/routes/device-router/probe/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isValidSignals, classify, deriveHints } from '@device-router/types';

export const POST: RequestHandler = async ({ request, cookies }) => {
  const body = await request.json();

  if (!isValidSignals(body)) {
    return json({ error: 'Invalid signals' }, { status: 400 });
  }

  const tiers = classify(body);
  const hints = deriveHints(tiers);

  cookies.set('dr_tiers', JSON.stringify(tiers), {
    httpOnly: true,
    secure: true,
    maxAge: 86400,
    path: '/',
  });

  return json({ ok: true });
};
```

## Browser Compatibility Note

`classifyFromHeaders` relies on Client Hints headers (`Device-Memory`, `Save-Data`, `Sec-CH-UA-Mobile`) that are only sent by Chromium-based browsers. On Safari and Firefox, classification falls back to User-Agent parsing only, which is less accurate. See the [browser compatibility table](getting-started.md#browser-compatibility) in the Getting Started guide for details.

If you need higher accuracy on non-Chromium browsers, combine header-based classification with the probe (which works on all browsers) or use a `fallbackProfile` for conservative defaults on the first request.
