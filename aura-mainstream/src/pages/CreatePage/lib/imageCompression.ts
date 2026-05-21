/** 2026-05-11 R10: down-scale a data URL image to fit a max longest-side
 *  in pixels and re-encode as JPEG at the given quality. Returns the
 *  compressed data URL (still 'data:image/jpeg;base64,...'). Skips work
 *  if the image is already smaller than the target.
 *  Extracted from CreatePage.tsx 2026-05-20 P-1 split. */
export async function compressImageDataUrl(
  dataUrl: string,
  maxLongestSide: number,
  quality: number,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const longest = Math.max(img.width, img.height);
      if (longest <= maxLongestSide) {
        // Already small enough — re-encode anyway as JPEG so we strip
        // any EXIF + alpha overhead and benefit from JPEG compression.
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(dataUrl);
        ctx.drawImage(img, 0, 0);
        return resolve(canvas.toDataURL('image/jpeg', quality));
      }
      const scale = maxLongestSide / longest;
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(dataUrl);
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('image load failed'));
    img.src = dataUrl;
  });
}
