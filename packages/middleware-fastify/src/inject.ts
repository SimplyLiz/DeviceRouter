import type { FastifyRequest, FastifyReply } from 'fastify';

export interface InjectOptions {
  probeScript: string;
  nonce?: string | ((req: FastifyRequest) => string);
}

export function createInjectionMiddleware(options: InjectOptions) {
  const { probeScript, nonce } = options;

  return (
    req: FastifyRequest,
    reply: FastifyReply,
    payload: string,
    done: (err: Error | null, payload?: string) => void,
  ): void => {
    const contentType = reply.getHeader('content-type');

    if (typeof payload !== 'string' || !isHtml(contentType)) {
      done(null, payload);
      return;
    }

    const nonceValue = typeof nonce === 'function' ? nonce(req) : nonce;
    const nonceAttr = nonceValue ? ` nonce="${nonceValue}"` : '';
    const scriptTag = `<script${nonceAttr}>${probeScript}</script>`;

    const headIdx = payload.indexOf('</head>');
    if (headIdx !== -1) {
      done(null, payload.slice(0, headIdx) + scriptTag + payload.slice(headIdx));
      return;
    }

    const bodyIdx = payload.indexOf('</body>');
    if (bodyIdx !== -1) {
      done(null, payload.slice(0, bodyIdx) + scriptTag + payload.slice(bodyIdx));
      return;
    }

    done(null, payload);
  };
}

function isHtml(contentType: unknown): boolean {
  if (typeof contentType === 'string') {
    return contentType.includes('text/html');
  }
  return false;
}
