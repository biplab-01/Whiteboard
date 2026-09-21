/**
 * Utilities for media processing, image optimization, and canvas data sanitization.
 * Guarantees that imported photos/images are saved as persistent Base64 Data URLs
 * rather than temporary in-memory Blob URLs which expire when the session ends.
 */

export const isImageFile = (file: File): boolean => {
  if (file.type && file.type.startsWith('image/')) return true;
  const name = (file.name || '').toLowerCase();
  return /\.(png|jpe?g|webp|gif|svg|bmp|avif|ico)$/i.test(name);
};

export const isPdfFile = (file: File): boolean => {
  if (file.type === 'application/pdf') return true;
  const name = (file.name || '').toLowerCase();
  return /\.pdf$/i.test(name);
};

/**
 * Converts an image file to a persistent Base64 Data URL.
 * Automatically optimizes oversized photos (> 2048px or > 1.5MB) to keep
 * canvas JSON compact, responsive, and persistent in IndexedDB and Supabase.
 */
export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const dataUrl = reader.result as string;

      // Small images or vector SVGs do not need resizing
      if (file.type === 'image/svg+xml' || file.size < 1.5 * 1024 * 1024) {
        resolve(dataUrl);
        return;
      }

      // For larger photos/images, scale down to max 2048px on the longest edge
      try {
        const img = new Image();
        img.onload = () => {
          const maxDim = 2048;
          let width = img.naturalWidth || img.width;
          let height = img.naturalHeight || img.height;

          if (width <= maxDim && height <= maxDim) {
            resolve(dataUrl);
            return;
          }

          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(dataUrl);
            return;
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          // Use PNG if original is PNG to keep transparent backgrounds, otherwise high-quality JPEG
          const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          const quality = mime === 'image/jpeg' ? 0.92 : undefined;
          resolve(canvas.toDataURL(mime, quality));
        };

        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
      } catch {
        resolve(dataUrl);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * 1x1 transparent PNG data URL to substitute for dead/unresolvable image URLs
 * to ensure canvas.loadFromJSON never rejects or wipes the board.
 */
export const TRANSPARENT_FALLBACK_PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

/**
 * Checks if a specific image URL can be loaded successfully.
 */
export const isImageSrcLoadable = (src: string, timeoutMs: number = 2000): Promise<boolean> => {
  if (!src) return Promise.resolve(false);
  if (src.startsWith('data:')) return Promise.resolve(true);

  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    const testImg = new Image();
    testImg.onload = () => {
      clearTimeout(timer);
      resolve(true);
    };
    testImg.onerror = () => {
      clearTimeout(timer);
      resolve(false);
    };
    testImg.src = src;
  });
};

/**
 * Sanitizes parsed canvas JSON before handing it to canvas.loadFromJSON.
 * Prevents fabric.js from rejecting or aborting when encountering legacy dead blob: URLs.
 */
export async function sanitizeCanvasJsonForLoading(parsed: any): Promise<any> {
  if (!parsed || !Array.isArray(parsed.objects)) {
    return parsed;
  }

  const objects = parsed.objects;
  const sanitizedObjects: any[] = [];

  for (const obj of objects) {
    const type = (obj.type || '').toLowerCase();
    if (type === 'image') {
      const src = obj.src || '';

      // If it's a blob: URL, it is most likely dead from a previous browser session
      if (src.startsWith('blob:')) {
        const isAlive = await isImageSrcLoadable(src, 1000);
        if (!isAlive) {
          console.warn('Sanitizing dead blob image URL from previous session:', src);
          // Keep object layout/dimensions with fallback pixel so canvas load succeeds
          sanitizedObjects.push({
            ...obj,
            src: TRANSPARENT_FALLBACK_PIXEL,
          });
          continue;
        }
      }
    }
    sanitizedObjects.push(obj);
  }

  return {
    ...parsed,
    objects: sanitizedObjects,
  };
}
