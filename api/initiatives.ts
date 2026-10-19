import type { IncomingMessage, ServerResponse } from 'node:http';
import { createAuthMiddleware } from '../server/authApi.ts';

export default async function handler(request: IncomingMessage & { body?: unknown }, response: ServerResponse) {
  await createAuthMiddleware(process.env)(request, response, () => {
    response.statusCode = 405;
    response.setHeader('Allow', 'GET, POST');
    response.end(JSON.stringify({ error: 'Method not allowed' }));
  });
}
