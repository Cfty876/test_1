import { BlobNotFoundError, get, head } from '@vercel/blob';

/** Read a document together with the origin version used by a later CAS write. */
export async function readBlobDocument(key: string, storeId: string, access: 'public' | 'private') {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    let before;
    try { before = await head(key, { storeId }); }
    catch (error) { if (error instanceof BlobNotFoundError) return null; throw error; }
    // Public GETs use the CDN. Version the URL so an older cached response
    // cannot be paired with a newer origin ETag and overwrite another write.
    const url = new URL(before.url);
    if (access === 'public') url.searchParams.set('v', before.etag);
    const blob = await get(access === 'public' ? url.toString() : key, { access, storeId, useCache: false });
    if (!blob) continue;
    const value = await new Response(blob.stream).text();
    const after = await head(key, { storeId });
    if (before.etag === after.etag) return { value, etag: after.etag };
  }
  throw new Error('Blob document changed while reading');
}
