// Leave headroom below the production function's 4.5 MB wire limit.
export const MAX_API_WIRE_BYTES = 4 * 1024 * 1024;
const COMPRESSION_THRESHOLD = 256 * 1024;
// Matches Express's limit on the decompressed JSON body.
const MAX_JSON_BYTES = 50 * 1024 * 1024;

export class ApiPayloadError extends Error {
  readonly code = 'PAYLOAD_TOO_LARGE';
  readonly isBusinessError = true;
  constructor() {
    super('PAYLOAD_TOO_LARGE');
  }
}

/** Keep the original JSON in the outbox; encode only the wire request. */
async function encodeApiPayload(init: RequestInit): Promise<RequestInit> {
  if (typeof init.body !== 'string') return init;
  const headers = new Headers(init.headers);
  if (headers.has('Content-Encoding')) return init;
  const contentType = headers.get('Content-Type') || 'application/json';
  if (!contentType.includes('application/json')) return init;
  const bytes = new TextEncoder().encode(init.body);
  if (bytes.byteLength > MAX_JSON_BYTES) throw new ApiPayloadError();
  if (bytes.byteLength < COMPRESSION_THRESHOLD) return init;

  if (typeof CompressionStream !== 'undefined') {
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
    const compressed = await new Response(stream).blob();
    if (compressed.size < bytes.byteLength) {
      if (compressed.size > MAX_API_WIRE_BYTES) throw new ApiPayloadError();
      headers.set('Content-Encoding', 'gzip');
      headers.set('Content-Type', 'application/json');
      return { ...init, headers, body: compressed };
    }
  }
  if (bytes.byteLength > MAX_API_WIRE_BYTES) throw new ApiPayloadError();
  return init;
}

/** Retry existing outbox bodies through exactly the same adaptive image path. */
export async function prepareApiPayload(init: RequestInit): Promise<RequestInit> {
  try {
    return await encodeApiPayload(init);
  } catch (error) {
    if (!(error instanceof ApiPayloadError) || typeof init.body !== 'string') throw error;
    let original: unknown;
    try { original = JSON.parse(init.body); } catch { throw error; }
    // Do not fetch remote URLs or strip images, receipts, history or metadata.
    if (!/data:image\/(?:jpeg|jpg|png|webp);base64,/i.test(init.body)) throw error;
    const { shrinkEmbeddedImages } = await import('../utils/imageCompressor');
    for (const profile of [
      { maxWidth: 1280, maxHeight: 1280, quality: 0.72, maxDataUrlChars: 180000 },
      { maxWidth: 960, maxHeight: 960, quality: 0.64, maxDataUrlChars: 100000 },
      { maxWidth: 720, maxHeight: 720, quality: 0.55, maxDataUrlChars: 50000 }
    ]) {
      const reduced = await shrinkEmbeddedImages(original, profile);
      try {
        return await encodeApiPayload({ ...init, body: JSON.stringify(reduced) });
      } catch (nextError) {
        if (!(nextError instanceof ApiPayloadError)) throw nextError;
      }
    }
    // No infinite degradation of screenshots. Keep the unsent original in its queue.
    throw error;
  }
}
