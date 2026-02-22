import type { MiddlewareHandler, Context } from 'hono';

export interface InjectOptions {
  probeScript: string;
  nonce?: string | ((c: Context) => string);
}

export function createInjectionMiddleware(options: InjectOptions): MiddlewareHandler {
  const { probeScript, nonce } = options;

  return async (c, next) => {
    await next();

    const contentType = c.res.headers.get('content-type');
    if (!contentType || !contentType.includes('text/html')) {
      return;
    }

    const originalStatus = c.res.status;
    const originalHeaders = new Headers(c.res.headers);
    originalHeaders.delete('content-length');
    const body = await c.res.text();

    const nonceValue = typeof nonce === 'function' ? nonce(c) : nonce;
    const nonceAttr = nonceValue ? ` nonce="${nonceValue}"` : '';
    const scriptTag = `<script${nonceAttr}>${probeScript}</script>`;

    let result = body;
    const headIdx = body.indexOf('</head>');
    if (headIdx !== -1) {
      result = body.slice(0, headIdx) + scriptTag + body.slice(headIdx);
    } else {
      const bodyIdx = body.indexOf('</body>');
      if (bodyIdx !== -1) {
        result = body.slice(0, bodyIdx) + scriptTag + body.slice(bodyIdx);
      }
    }

    c.res = new Response(result, {
      status: originalStatus,
      headers: originalHeaders,
    });
  };
}
