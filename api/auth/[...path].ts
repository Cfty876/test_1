import type { IncomingMessage, ServerResponse } from 'node:http';
import { createAuthMiddleware } from '../../server/authApi.ts';

type VercelRequest = IncomingMessage & { url?: string; method?: string };

export default async function handler(request: VercelRequest, response: ServerResponse) {
  const middleware = createAuthMiddleware(process.env);
  await middleware(request, response, () => {
    response.statusCode = 404;
    response.end(JSON.stringify({ error: 'Not found' }));
  });
}
