/**
 * Supabase client — single shared instance for the whole app.
 *
 * Hackathon-grade: we use the publishable (anon) key from the browser and
 * rely on the SECURITY DEFINER RPCs (dm_send / dm_mark_read /
 * dm_get_or_create_thread) for every write. RLS on dm_threads /
 * dm_messages is enabled so direct table reads/writes from anon are
 * blocked; the RPCs run with elevated rights inside Postgres but check
 * arguments before touching data.
 *
 * For production we will issue real wallet-bound JWTs from an Edge
 * Function so RLS policies that read auth.jwt()->>'wallet' kick in.
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const SUPABASE_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_ANON);

if (!SUPABASE_CONFIGURED) {
  // Surface during dev so a missing env var doesn't fail silently.
  // eslint-disable-next-line no-console
  console.warn(
    '[supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY missing — DM features disabled.',
  );
}

export const supabase = SUPABASE_CONFIGURED
  ? createClient(SUPABASE_URL!, SUPABASE_ANON!, {
      auth: { persistSession: false },
      realtime: { params: { eventsPerSecond: 5 } },
    })
  : null;

/** Iris's wallet — the canonical "from" address for AI replies. */
export const IRIS_WALLET = (import.meta.env.VITE_IRIS_WALLET as string) || '';
