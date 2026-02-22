import type { Context, Next } from 'koa';

export interface InjectOptions {
  probeScript: string;
  nonce?: string | ((ctx: Context) => string);
}

export function createInjectionMiddleware(options: InjectOptions) {
  const { probeScript, nonce } = options;

  return async (ctx: Context, next: Next): Promise<void> => {
    await next();

    if (typeof ctx.body !== 'string' || !isHtml(ctx.type)) {
      return;
    }

    const nonceValue = typeof nonce === 'function' ? nonce(ctx) : nonce;
    const nonceAttr = nonceValue ? ` nonce="${nonceValue}"` : '';
    const scriptTag = `<script${nonceAttr}>${probeScript}</script>`;

    const headIdx = ctx.body.indexOf('</head>');
    if (headIdx !== -1) {
      ctx.body = ctx.body.slice(0, headIdx) + scriptTag + ctx.body.slice(headIdx);
      return;
    }

    const bodyIdx = ctx.body.indexOf('</body>');
    if (bodyIdx !== -1) {
      ctx.body = ctx.body.slice(0, bodyIdx) + scriptTag + ctx.body.slice(bodyIdx);
    }
  };
}

function isHtml(type: string): boolean {
  return type.includes('text/html') || type === 'html';
}
