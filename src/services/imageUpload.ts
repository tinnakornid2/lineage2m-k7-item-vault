import { centralApi } from './centralApi';
import { compressImageFile, compressBase64, type CompressionOptions } from '../utils/imageCompressor';

export async function uploadEmbeddedImage(imageBase64: string, expectedUserId?: string): Promise<string> {
  const reduced = await compressBase64(imageBase64);
  const response = await centralApi('/api/upload-image', {
    method: 'POST', body: JSON.stringify({ imageBase64: reduced })
  }, undefined, false, expectedUserId);
  const result = await response.json();
  if (!result.success || typeof result.url !== 'string' || !result.url.startsWith('https://firebasestorage.googleapis.com/')) {
    throw new Error('IMAGE_UPLOAD_FAILED');
  }
  return result.url;
}

/** Never return an embedded image as an upload-success fallback. */
export async function prepareImageFile(file: File, options: CompressionOptions = {}): Promise<string> {
  return uploadEmbeddedImage(await compressImageFile(file, options));
}

/** Only our Storage URLs are downloaded for OCR; arbitrary remote URLs are rejected. */
export async function imageForOcr(value: string): Promise<string> {
  if (value.startsWith('data:image/')) return value;
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== 'firebasestorage.googleapis.com' ||
      !url.pathname.startsWith('/v0/b/clan-hub-7645f.firebasestorage.app/o/')) throw new Error('INVALID_OCR_IMAGE_URL');
  const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error('OCR_IMAGE_DOWNLOAD_FAILED');
  const blob = await response.blob();
  if (blob.size > 2 * 1024 * 1024) throw new Error('OCR_IMAGE_TOO_LARGE');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('OCR_IMAGE_READ_FAILED'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

export async function uploadImagesInPayload(value: unknown, expectedUserId?: string): Promise<unknown> {
  const memo = new Map<string, Promise<string>>();
  async function visit(node: any): Promise<any> {
    if (typeof node === 'string' && /^data:image\/(?:jpeg|png|webp);base64,/i.test(node)) {
      if (!memo.has(node)) memo.set(node, uploadEmbeddedImage(node, expectedUserId));
      return memo.get(node);
    }
    if (Array.isArray(node)) { const out = []; for (const entry of node) out.push(await visit(entry)); return out; }
    if (node && typeof node === 'object') {
      const out: Record<string, unknown> = {};
      for (const [key, entry] of Object.entries(node)) out[key] = await visit(entry);
      return out;
    }
    return node;
  }
  return visit(value);
}
