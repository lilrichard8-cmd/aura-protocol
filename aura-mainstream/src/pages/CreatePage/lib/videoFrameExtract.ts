/** 2026-05-11 R14: grab a single representative frame from a video file
 *  and return it as a compressed JPEG data URL. We seek to 0.5s (skipping
 *  the typical black opening frame), draw to canvas, and JPEG-encode at
 *  quality 0.85. Resolves to a JPEG data URL no wider than maxLongestSide.
 *  Extracted from CreatePage.tsx 2026-05-20 P-1 split. */
export async function extractVideoFirstFrame(
  videoUrl: string,
  maxLongestSide = 1280,
  quality = 0.85,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.src = videoUrl;
    const cleanup = () => {
      video.removeAttribute('src');
      video.load();
    };
    video.onloadeddata = () => {
      // Some browsers fire loadeddata before the first frame is paintable;
      // seek to 0.5s to force a real frame paint.
      const target = Math.min(0.5, (video.duration || 1) / 2);
      video.currentTime = target;
    };
    video.onseeked = () => {
      try {
        const longest = Math.max(video.videoWidth, video.videoHeight);
        const scale = longest > maxLongestSide ? maxLongestSide / longest : 1;
        const w = Math.round(video.videoWidth * scale);
        const h = Math.round(video.videoHeight * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { cleanup(); return reject(new Error('canvas unavailable')); }
        ctx.drawImage(video, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        cleanup();
        resolve(dataUrl);
      } catch (err) {
        cleanup();
        reject(err);
      }
    };
    video.onerror = () => {
      cleanup();
      reject(new Error('video load failed'));
    };
  });
}
