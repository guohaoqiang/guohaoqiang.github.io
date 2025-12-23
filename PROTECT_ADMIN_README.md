Protecting /admin.html — options and quick samples

This repository now includes two sample server-side approaches you can deploy to protect the admin page (do NOT store secrets in the repo):

1) Cloudflare Worker (recommended if you use Cloudflare)
   - File: cloudflare-worker/worker.js
   - Behavior: proxies requests for /admin.html only if the request includes a valid token (query param ?token=... or Authorization: Bearer ...). The worker checks the token against the environment variable ADMIN_TOKEN. It then fetches /admin.html from your origin (set ORIGIN in the worker env) and returns it.

   Quick deploy steps with Wrangler (Cloudflare Workers):
   - Install Wrangler: https://developers.cloudflare.com/workers/cli-wrangler/install/
   - Create a project and copy cloudflare-worker/worker.js into it (or use "wrangler publish" with this file).
   - In your Cloudflare dashboard or wrangler.toml, set the following environment variables: ADMIN_TOKEN and ORIGIN (your site host, e.g. hqguo.github.io).
   - Example wrangler.toml (minimal):
     name = "admin-proxy"
     main = "cloudflare-worker/worker.js"
     type = "javascript"

   - Then deploy:
     wrangler publish

   - Access the admin page via the worker route (e.g., https://<worker-subdomain>.workers.dev/admin.html?token=YOUR_SECRET) or configure a route in Cloudflare to match your site domain and have the worker run there.

## Quick test (after worker is deployed)

1. Generate a short-lived token locally using the `scripts/make_jwt.py` helper and your private key (do NOT commit your private key):

```bash
# example: generate a token valid for 5 minutes
python3 scripts/make_jwt.py --private private.pem --exp 300
```

2. Use curl to request the protected admin page. Replace <TOKEN> and <WORKER_URL> with your token and worker endpoint:

```bash
curl -i -H "Authorization: Bearer <TOKEN>" "https://<WORKER_URL>/admin.html"
```

If the worker is configured and the token is valid you should receive a 200 and the HTML of `admin.html`. If the token is missing/invalid you'll receive a 401/403 depending on your worker's configuration.
2) Netlify Function (or other serverless platforms)
   - File: netlify/functions/admin-proxy.js
   - Behavior: similar to the Worker. Netlify function checks process.env.ADMIN_TOKEN and proxies /admin.html if the token matches.

   Quick deploy steps on Netlify:
   - Put netlify/functions/admin-proxy.js in your project (Netlify will auto-deploy functions in that folder).
   - In Netlify site settings, add an environment variable ADMIN_TOKEN with your secret, and ORIGIN with your site hostname.
   - Deploy the site.
   - Access the function at: https://<your-site>/.netlify/functions/admin-proxy?token=YOUR_SECRET
   - You can then link to this function URL as your admin entrypoint or use the function to proxy content.

Notes & recommendations
- Do NOT commit tokens or passwords to the repository. Use environment variables in Cloudflare/Netlify to store them.
- Cloudflare Access (zero-config auth) is often easier and more secure: you can create an "Access" application in the Cloudflare dashboard and protect the admin path with identity providers (Google, GitHub, etc.). If you want I can walk through those steps.
- These server-side gate examples are simple: they rely on a shared secret. For stronger authentication, use OAuth or Cloudflare Access.
- If you'd like, I can also update `index.html` so the Admin nav item points to the protected worker/function URL instead of directly to /admin.html.

If you want me to deploy one of these samples for you (prepare wrangler.toml, Netlify config, and update the nav link), tell me which platform (Cloudflare Workers or Netlify) and I will create the needed config files and update `index.html` to point to the protected endpoint.
