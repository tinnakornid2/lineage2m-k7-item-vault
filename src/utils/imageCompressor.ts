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
        const dataUrl = canvas.toDataURL(mimeType, quality);
        resolve(dataUrl);
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

  return new Promise((resolve) => {
    const img = new Image();
    img.onerror = () => resolve(base64); // Fallback to original
    img.onload = () => {
      let { width, height } = img;
      if (width <= maxWidth && height <= maxHeight && base64.length < 200000) {
        resolve(base64);
        return;
      }

      const ratio = Math.min(maxWidth / width, maxHeight / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL(mimeType, quality));
    };
    img.src = base64;
  });
}
