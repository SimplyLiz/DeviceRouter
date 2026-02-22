import type { Request, Response, NextFunction } from 'express';

export interface InjectOptions {
  probeScript: string;
  nonce?: string | ((req: Request) => string);
}

export function createInjectionMiddleware(options: InjectOptions) {
  const { probeScript, nonce } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    const originalSend = res.send.bind(res);

    res.send = function injectedSend(body?: unknown): Response {
      if (typeof body === 'string' && isHtmlResponse(res)) {
        const nonceValue = typeof nonce === 'function' ? nonce(req) : nonce;
        const nonceAttr = nonceValue ? ` nonce="${nonceValue}"` : '';
        const scriptTag = `<script${nonceAttr}>${probeScript}</script>`;

        const headIdx = body.indexOf('</head>');
        if (headIdx !== -1) {
          body = body.slice(0, headIdx) + scriptTag + body.slice(headIdx);
        } else {
          const bodyIdx = body.indexOf('</body>');
          if (bodyIdx !== -1) {
            body = body.slice(0, bodyIdx) + scriptTag + body.slice(bodyIdx);
          }
        }
      }

      return originalSend(body);
    };

    next();
  };
}

function isHtmlResponse(res: Response): boolean {
  const contentType = res.getHeader('content-type');
  if (typeof contentType === 'string') {
    return contentType.includes('text/html');
  }
  // If no content-type set yet, Express will set it based on the body.
  // For string bodies without explicit content-type, Express defaults to text/html.
  return contentType === undefined;
}
