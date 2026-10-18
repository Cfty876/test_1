import type { IncomingMessage, ServerResponse } from 'node:http';
import { handlePlatformRequest } from '../../server/platformHandler.ts';

type VercelRequest = IncomingMessage & { url?: string; method?: string; body?: unknown };

export default async function handler(request: VercelRequest, response: ServerResponse) {
  await handlePlatformRequest(request, response);
}
