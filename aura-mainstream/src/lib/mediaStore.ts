// 2026-05-11 R10: tiny IndexedDB-backed media store.
//
// Why: localStorage is capped at ~5-10MB *total* across the whole app, and
// audio/video files base64-encoded as data: URLs easily blow that quota
// (Zhuoyu hit "exceeded the quota" trying to publish a single audio post).
//
// What this gives us: a key/value store for large media blobs (audio,
// video, hi-res images) that lives in IndexedDB (browser-side, unlimited
// in practice — capped only by free-disk and user permission). Each item
// is stored once and referenced from `aura_user_posts` (in localStorage)
// by a short `media:<id>` token. The Post-rendering helpers resolve the
// token back to a blob: URL at runtime.
//
// API:
//   await putMedia(blob, mimeType?) -> mediaRef ('media:<uuid>')
//   await getMediaUrl(ref)          -> blob: URL string | null
//   await getMediaBlob(ref)         -> Blob | null
//   await deleteMedia(ref)          -> void
//   await listMediaIds()            -> string[]
//
// Note on object URLs: `getMediaUrl` lazily creates a blob: URL the first
// time a reference is requested in this page lifecycle and caches it on
// `window.__auraMediaUrlCache__`. blob: URLs are page-scoped, so on
// refresh we just re-create them from the underlying blob.

const DB_NAME = 'aura_media';
const STORE = 'media';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function isMediaRef(s: unknown): s is string {
  return typeof s === 'string' && s.startsWith('media:');
}

/** Persist a Blob (or File) and return a stable reference token. */
export async function putMedia(blob: Blob): Promise<string> {
  const id = crypto.randomUUID();
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  return `media:${id}`;
}

/** Convenience: persist a base64 data URL by converting to Blob first. */
export async function putDataUrl(dataUrl: string): Promise<string> {
  const resp = await fetch(dataUrl);
  const blob = await resp.blob();
  return putMedia(blob);
}

/** Look up the raw Blob behind a media reference. */
export async function getMediaBlob(ref: string): Promise<Blob | null> {
  if (!isMediaRef(ref)) return null;
  const id = ref.slice(6);
  const db = await openDb();
  const blob = await new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return blob;
}

// Lazily-built cache so repeated reads return the same blob: URL.
function urlCache(): Map<string, string> {
  const w = window as unknown as { __auraMediaUrlCache__?: Map<string, string> };
  if (!w.__auraMediaUrlCache__) w.__auraMediaUrlCache__ = new Map();
  return w.__auraMediaUrlCache__;
}

/** Resolve a media reference to an in-memory blob: URL for <img>/<audio>/<video>. */
export async function getMediaUrl(ref: string): Promise<string | null> {
  if (!isMediaRef(ref)) return ref; // already a plain URL
  const cache = urlCache();
  const cached = cache.get(ref);
  if (cached) return cached;
  const blob = await getMediaBlob(ref);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  cache.set(ref, url);
  return url;
}

export async function deleteMedia(ref: string): Promise<void> {
  if (!isMediaRef(ref)) return;
  const id = ref.slice(6);
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  const cache = urlCache();
  const cached = cache.get(ref);
  if (cached) URL.revokeObjectURL(cached);
  cache.delete(ref);
}

export async function listMediaIds(): Promise<string[]> {
  const db = await openDb();
  const ids = await new Promise<string[]>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAllKeys();
    req.onsuccess = () => resolve((req.result as IDBValidKey[]).map(String));
    req.onerror = () => reject(req.error);
  });
  db.close();
  return ids.map(id => `media:${id}`);
}

export { isMediaRef };
