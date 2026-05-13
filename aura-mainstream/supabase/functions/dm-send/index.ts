// Edge Function: dm-send
//
// Authenticated DM send. The caller proves wallet ownership via a
// session token (issued by wallet-auth). The function re-issues the
// SECURITY DEFINER dm_send RPC with service_role credentials, but
// forces from_wallet = session.wallet so a stolen token cannot be used
// to forge a different sender than the one that signed in.
//
// Body:
//   { sessionToken, toWallet, content, kind? }

import { jsonResponse, preflight } from '../_shared/cors.ts';
import { adminClient, verifySession } from '../_shared/session.ts';

const MAX_CONTENT = 4000;

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const origin = req.headers.get('origin');
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405, origin);

  let body: { sessionToken?: string; toWallet?: string; content?: string; kind?: string };
  try { body = await req.json(); } catch { return jsonResponse({ error: 'invalid_json' }, 400, origin); }
  const { sessionToken, toWallet, content, kind } = body;
  if (!sessionToken || !toWallet || !content) {
    return jsonResponse({ error: 'missing_fields' }, 400, origin);
  }
  if (typeof content !== 'string' || content.length === 0 || content.length > MAX_CONTENT) {
    return jsonResponse({ error: 'invalid_content' }, 400, origin);
  }
  if (typeof toWallet !== 'string' || toWallet.length < 32 || toWallet.length > 44) {
    return jsonResponse({ error: 'invalid_to_wallet' }, 400, origin);
  }

  const session = await verifySession(sessionToken);
  if (!session) return jsonResponse({ error: 'session_invalid' }, 401, origin);
  if (session.wallet === toWallet) {
    return jsonResponse({ error: 'cannot_message_self' }, 400, origin);
  }

  const sb = adminClient();
  const { data, error } = await sb.rpc('dm_send', {
    from_wallet: session.wallet, // forced from session — client cannot lie
    to_wallet: toWallet,
    content,
    kind: kind ?? 'text',
  });
  if (error) return jsonResponse({ error: 'rpc_failed', detail: error.message }, 500, origin);

  return jsonResponse({ message: data }, 200, origin);
});
