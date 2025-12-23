// Cloudflare Worker example to protect /admin.html using a server-side token.
// Deploy with Wrangler and set the ADMIN_TOKEN and ORIGIN environment variables.
// The worker will respond to requests for /admin.html and proxy the admin page from ORIGIN
// only if the incoming request includes a correct token either as ?token=... or
// as Authorization: Bearer <token>.

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      // Only protect the admin path; let other requests pass through (optional)
      if (!url.pathname.startsWith('/admin.html')) {
        return fetch(request);
      }

      const token = url.searchParams.get('token') || (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
      if (!token || token !== env.ADMIN_TOKEN) {
        return new Response('Unauthorized', { status: 401 });
      }

      // Fetch the admin page from your origin. Set ORIGIN in your worker environment (e.g., example.com)
      const origin = env.ORIGIN || request.headers.get('host');
      const adminUrl = `https://${origin}/admin.html`;
      const resp = await fetch(adminUrl, { headers: { Accept: 'text/html' } });
      const headers = new Headers(resp.headers);
      headers.set('Content-Type', 'text/html; charset=utf-8');
      return new Response(await resp.arrayBuffer(), { status: resp.status, headers });
    } catch (err) {
      return new Response('Worker error', { status: 500 });
    }
  }
};
