/**
 * Image compressor utility for Lineage2M Vault
 * Compresses images before uploading to OCR endpoint and saving to Firestore
 * to prevent exceeding Firestore's 1MB document size limit and improve performance.
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  mimeType?: 'image/jpeg' | 'image/webp' | 'image/png';
  maxDataUrlChars?: number;
}

export async function compressImageFile(
  file: File,
  options: CompressionOptions = {}
): Promise<string> {
  const {
    maxWidth = 1280,
    maxHeight = 1280,
    quality = 0.75,
    mimeType = 'image/jpeg'
  } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image for compression'));
      img.onload = () => {
        let { width, height } = img;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }

        // Fill background white for JPEGs
        if (mimeType === 'image/jpeg') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
        }

        ctx.drawImage(img, 0, 0, width, height);
        try { resolve(encodeWithinBudget(img, canvas, options)); }
        catch (error) { reject(error); }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export async function compressBase64(
  base64: string,
  options: CompressionOptions = {}
): Promise<string> {
  const {
    maxWidth = 1280,
    maxHeight = 1280,
    quality = 0.75,
    mimeType = 'image/jpeg'
  } = options;

  if (typeof Image === 'undefined' || typeof document === 'undefined') return base64;
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => resolve(base64), 10000);
    img.onerror = () => { clearTimeout(timer); resolve(base64); }; // Preserve unreadable originals
    img.onload = () => {
      clearTimeout(timer);
      let { width, height } = img;
      if (width <= maxWidth && height <= maxHeight && base64.length <= (options.maxDataUrlChars || 180000)) {
        resolve(base64);
        return;
      }

      const ratio = Math.min(1, maxWidth / width, maxHeight / height);
      width = Math.max(1, Math.round(width * ratio));
      height = Math.max(1, Math.round(height * ratio));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64);
        return;
      }

      try {
        const result = encodeWithinBudget(img, canvas, options);
        resolve(result.length < base64.length ? result : base64);
      } catch { resolve(base64); }
    };
    img.src = base64;
  });
}

/** Reduce quality/dimensions gradually, always drawing from the original image. */
function encodeWithinBudget(img: HTMLImageElement, canvas: HTMLCanvasElement, options: CompressionOptions): string {
  const mimeType = options.mimeType || 'image/jpeg';
  const budget = options.maxDataUrlChars || 180000;
  let quality = options.quality ?? 0.75;
  let best = '';
  for (let attempt = 0; attempt < 7; attempt++) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('IMAGE_CANVAS_UNAVAILABLE');
    if (mimeType === 'image/jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const encoded = canvas.toDataURL(mimeType, quality);
    if (!best || encoded.length < best.length) best = encoded;
    if (best.length <= budget) return best;
    if (quality > 0.55) quality = Math.max(0.55, quality - 0.1);
    else {
      canvas.width = Math.max(1, Math.round(canvas.width * 0.8));
      canvas.height = Math.max(1, Math.round(canvas.height * 0.8));
    }
  }
  return best;
}

/** Clone JSON, shrinking embedded raster images only; URLs and metadata stay intact. */
export async function shrinkEmbeddedImages<T>(value: T, options: CompressionOptions): Promise<T> {
  const images = new Map<string, Promise<string>>();
  async function visit(node: any): Promise<any> {
    if (typeof node === 'string' && /^data:image\/(?:jpeg|jpg|png|webp);base64,/i.test(node)) {
      if (!images.has(node)) images.set(node, compressBase64(node, options));
      return images.get(node);
    }
    if (Array.isArray(node)) {
      const result = [];
      for (const entry of node) result.push(await visit(entry));
      return result;
    }
    if (node && typeof node === 'object') {
      const result = Object.create(null);
      for (const [key, entry] of Object.entries(node)) result[key] = await visit(entry);
      return result;
    }
    return node;
  }
  return visit(value);
}
