import type { IncomingMessage, ServerResponse } from 'node:http';
import { createPlatformApi } from './platformApi.ts';

type VercelRequest = IncomingMessage & { url?: string; method?: string; body?: unknown };

export async function handlePlatformRequest(request: VercelRequest, response: ServerResponse) {
  const middleware = createPlatformApi(process.env);
  await middleware(request, response, () => {
    response.statusCode = 404;
    response.end(JSON.stringify({ error: 'Not found' }));
  });
}
