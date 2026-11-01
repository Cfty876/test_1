import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';
import { gzip } from 'node:zlib';
import type { IncomingMessage, ServerResponse } from 'node:http';

export const requestContext = new AsyncLocalStorage<IncomingMessage>();
const serialized = new WeakMap<object, { body: string; etag: string; gzip?: Promise<Buffer> }>();
export function sendJson(response: ServerResponse, status: number, payload: unknown) {
  const request = requestContext.getStore();
  let data = payload && typeof payload === 'object' ? serialized.get(payload) : undefined;
  if (!data) {
    const body = JSON.stringify(payload);
    data = { body, etag: `"${createHash('sha256').update(body).digest('base64url')}"` };
    if (payload && typeof payload === 'object') serialized.set(payload, data);
  }
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'private, no-store');
  response.setHeader('Vary', 'Cookie, Accept-Encoding');
  if (status === 200 && request?.method === 'GET') {
    const etag = String(response.getHeader('ETag') || data.etag);
    response.setHeader('ETag', etag);
    if (request.headers['if-none-match']?.split(/\s*,\s*/).includes(etag)) { response.statusCode = 304; response.end(); return; }
  } else response.setHeader('Cache-Control', 'no-store');
  if (data.body.length > 2048 && /\bgzip\b(?!\s*;\s*q=0(?:\D|$))/.test(request?.headers['accept-encoding'] || '')) {
    data.gzip ||= new Promise((resolve, reject) => gzip(data!.body, { level: 4 }, (error, buffer) => error ? reject(error) : resolve(buffer)));
    void data.gzip.then(buffer => { if (!response.destroyed) { response.setHeader('Content-Encoding', 'gzip'); response.setHeader('Content-Length', buffer.length); response.end(buffer); } }, () => { if (!response.destroyed) response.end(data!.body); });
  } else response.end(data.body);
}

/** Works in Node and pre-parsed serverless requests, with byte and time limits. */
export async function readJsonBody(request: IncomingMessage & { body?: unknown }, limit: number): Promise<Record<string, unknown>> {
  const validate = (value: unknown) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid request body');
    return value as Record<string, unknown>;
  };
  if (request.body !== undefined) {
    const encoded = typeof request.body === 'string' ? request.body : JSON.stringify(request.body);
    if (Buffer.byteLength(encoded) > limit) throw new Error('Request body too large');
    try { return validate(JSON.parse(encoded)); } catch { throw new Error('Invalid request body'); }
  }
  if (Number(request.headers['content-length']) > limit) { request.resume(); throw new Error('Request body too large'); }
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []; let size = 0;
    const finish = (error?: Error) => {
      clearTimeout(timer); request.off('data', data); request.off('end', end); request.off('error', fail); request.off('aborted', aborted);
      if (error) { request.resume(); reject(error); }
    };
    const fail = (error: Error) => finish(error);
    const aborted = () => finish(new Error('Request aborted'));
    const data = (chunk: Buffer) => { size += chunk.length; if (size > limit) finish(new Error('Request body too large')); else chunks.push(chunk); };
    const end = () => { finish(); try { resolve(validate(JSON.parse(Buffer.concat(chunks).toString('utf8')))); } catch { reject(new Error('Invalid request body')); } };
    const timer = setTimeout(() => finish(new Error('Request body timeout')), 15_000); timer.unref();
    request.on('data', data); request.once('end', end); request.once('error', fail); request.once('aborted', aborted);
  });
}
