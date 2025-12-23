// Cloudflare Worker (fixed): RS256 JWT verification and admin.html proxy
// Usage:
// - Deploy this worker with Wrangler and set the following secrets/vars in Cloudflare:
//   - PUBLIC_KEY  (PEM format, e.g. contents of public.pem)
//   - ORIGIN      (the backend origin that hosts admin.html, e.g. guohaoqiang.github.io)
// The token should be passed as Authorization: Bearer <JWT> or ?token=<JWT>.

addEventListener('fetch', event => {
  event.respondWith(handle(event.request, event));
});

function base64UrlToUint8Array(b64u) {
  b64u = b64u.replace(/-/g, '+').replace(/_/g, '/');
  while (b64u.length % 4) b64u += '=';
  const binary = atob(b64u);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function uint8ArrayFromPem(pem) {
  const lines = pem.split('\n');
  const filtered = lines.filter(l => l && !l.includes('BEGIN') && !l.includes('END')).join('');
  const binary = atob(filtered);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function importPublicKey(pem) {
  const spki = uint8ArrayFromPem(pem);
  return await crypto.subtle.importKey(
    'spki',
    spki.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
}

async function verifyJwtRS256(token, publicKey) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format');
  const signingInput = new TextEncoder().encode(parts[0] + '.' + parts[1]);
  const signature = base64UrlToUint8Array(parts[2]);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, signature, signingInput);
  if (!ok) throw new Error('Invalid signature');
  const payloadJson = JSON.parse(decodeURIComponent(escape(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')))));
  return payloadJson;
}

async function handle(request, event) {
  const url = new URL(request.url);
  // Proxy non-admin paths directly to the configured ORIGIN_HOST so assets like
  // /posts/posts.json are served from your origin when requested through the worker.
  const pathname = url.pathname || '/';
  if (!pathname.startsWith('/admin.html')) {
    const ORIGIN_HOST = (typeof ORIGIN !== 'undefined') ? ORIGIN : (globalThis.ORIGIN || null);
    if (!ORIGIN_HOST) return new Response('Server misconfigured: ORIGIN missing', { status: 500 });
    const originUrl = `https://${ORIGIN_HOST}${pathname}${url.search}`;
    try {
      const resp = await fetch(originUrl, { headers: { Accept: request.headers.get('Accept') || '*/*' } });
      const headers = new Headers(resp.headers);
      return new Response(await resp.arrayBuffer(), { status: resp.status, headers });
    } catch (err) {
      return new Response('Bad Gateway: failed to fetch origin (' + err.message + ')', { status: 502 });
    }
  }

  let token = null;
  const auth = request.headers.get('Authorization') || '';
  if (auth.startsWith('Bearer ')) token = auth.slice(7).trim();
  if (!token) token = url.searchParams.get('token');
  if (!token) return new Response('Unauthorized: missing token', { status: 401 });

  const PUBLIC_PEM = (typeof PUBLIC_KEY !== 'undefined') ? PUBLIC_KEY : (globalThis.PUBLIC_KEY || null);
  const ORIGIN_HOST = (typeof ORIGIN !== 'undefined') ? ORIGIN : (globalThis.ORIGIN || null);
  if (!PUBLIC_PEM) return new Response('Server misconfigured: PUBLIC_KEY missing', { status: 500 });
  if (!ORIGIN_HOST) return new Response('Server misconfigured: ORIGIN missing', { status: 500 });

  try {
    const pubKey = await importPublicKey(PUBLIC_PEM);
    const payload = await verifyJwtRS256(token, pubKey);
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && now > payload.exp) return new Response('Unauthorized: token expired', { status: 401 });
    if (payload.nbf && now < payload.nbf) return new Response('Unauthorized: token not yet valid', { status: 401 });
    if (payload.aud && payload.aud !== 'admin') return new Response('Unauthorized: bad audience', { status: 401 });

    const adminUrl = `https://${ORIGIN_HOST}/admin.html`;
    let resp;
    try {
      resp = await fetch(adminUrl, { headers: { Accept: 'text/html' } });
    } catch (fetchErr) {
      return new Response('Bad Gateway: failed to fetch origin (' + fetchErr.message + ')', { status: 502 });
    }
    const headers = new Headers(resp.headers);
    headers.set('Content-Type', 'text/html; charset=utf-8');
    return new Response(await resp.arrayBuffer(), { status: resp.status, headers });
  } catch (err) {
    const msg = String(err && err.message ? err.message : err);
    if (msg.match(/Invalid|token|signature|expired|not yet valid/i)) {
      return new Response('Unauthorized: ' + msg, { status: 401 });
    }
    return new Response('Server error: ' + msg, { status: 500 });
  }
}
