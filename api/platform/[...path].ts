import type { IncomingMessage, ServerResponse } from 'node:http';
import { createPlatformApi } from '../../server/platformApi.ts';

type VercelRequest = IncomingMessage & { url?: string; method?: string; body?: unknown };

export default async function handler(request: VercelRequest, response: ServerResponse) {
  const middleware = createPlatformApi(process.env);
  await middleware(request, response, () => {
    response.statusCode = 404;
    response.end(JSON.stringify({ error: 'Not found' }));
  });
}
