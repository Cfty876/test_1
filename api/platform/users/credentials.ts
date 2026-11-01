import type { IncomingMessage, ServerResponse } from 'node:http';
import { handlePlatformRequest } from '../../../server/platformHandler.ts';

export default async function handler(request: IncomingMessage & { body?: unknown }, response: ServerResponse) {
  await handlePlatformRequest(request, response);
}
