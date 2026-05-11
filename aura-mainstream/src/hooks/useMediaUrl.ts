// useMediaUrl — resolves a string that might be a `media:<uuid>` reference
// from the IndexedDB media store into a usable blob: URL for native HTML
// elements like <img>, <audio>, <video>. Plain http(s) / data: / blob:
// URLs are returned as-is on the first render.
//
// Usage:
//   const audioSrc = useMediaUrl(post.audioUrl);
//   return <audio src={audioSrc ?? undefined} />;

import { useEffect, useState } from 'react';
import { getMediaUrl, isMediaRef } from '@/lib/mediaStore';

export function useMediaUrl(ref: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(() => (
    ref && !isMediaRef(ref) ? ref : null
  ));

  useEffect(() => {
    if (!ref) {
      setUrl(null);
      return;
    }
    if (!isMediaRef(ref)) {
      setUrl(ref);
      return;
    }
    let cancelled = false;
    getMediaUrl(ref).then(resolved => {
      if (!cancelled) setUrl(resolved);
    }).catch(() => {
      if (!cancelled) setUrl(null);
    });
    return () => { cancelled = true; };
  }, [ref]);

  return url;
}
