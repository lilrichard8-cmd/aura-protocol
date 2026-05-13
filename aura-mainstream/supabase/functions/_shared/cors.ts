// CORS helpers shared by every Edge Function.
//
// We restrict to known production / staging origins. Wildcard '*' is
// rejected on purpose: a permissive CORS policy together with a session
// token leak in localStorage would let any third-party site call our
// auth-protected endpoints with the user's token.
const ALLOWED = new Set([
  'https://aura.li',
  'https://www.aura.li',
  'https://aura-vite.vercel.app',
  'http://localhost:5173',
  'http://localhost:5174',
]);

export function corsHeaders(origin: string | null): HeadersInit {
  const allow = origin && ALLOWED.has(origin) ? origin : 'https://aura.li';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

export function jsonResponse(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders(origin) },
  });
}

export function preflight(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders(req.headers.get('origin')) });
  }
  return null;
}
