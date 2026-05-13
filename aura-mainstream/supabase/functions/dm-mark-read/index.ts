// Edge Function: dm-mark-read
// Authenticated mark-as-read. viewer_wallet is forced from session.

import { jsonResponse, preflight } from '../_shared/cors.ts';
import { adminClient, verifySession } from '../_shared/session.ts';

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const origin = req.headers.get('origin');
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405, origin);

  let body: { sessionToken?: string; peerWallet?: string };
  try { body = await req.json(); } catch { return jsonResponse({ error: 'invalid_json' }, 400, origin); }
  const { sessionToken, peerWallet } = body;
  if (!sessionToken || !peerWallet) return jsonResponse({ error: 'missing_fields' }, 400, origin);

  const session = await verifySession(sessionToken);
  if (!session) return jsonResponse({ error: 'session_invalid' }, 401, origin);

  const sb = adminClient();
  const { data, error } = await sb.rpc('dm_mark_read', {
    viewer_wallet: session.wallet,
    peer_wallet: peerWallet,
  });
  if (error) return jsonResponse({ error: 'rpc_failed', detail: error.message }, 500, origin);
  return jsonResponse({ count: data ?? 0 }, 200, origin);
});
