// Netlify Function example to protect /admin.html using a server-side token.
// Place in netlify/functions/, set ADMIN_TOKEN and ORIGIN in Netlify site settings.
// This function proxies the admin page if the token matches (token via ?token=... or Authorization header).

const fetch = require('node-fetch');

exports.handler = async function(event, context) {
  try {
    const params = event.queryStringParameters || {};
    const token = params.token || ((event.headers && event.headers.authorization) || '').replace(/^Bearer\s+/i, '');
    const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
    if(!ADMIN_TOKEN || token !== ADMIN_TOKEN) {
      return { statusCode: 401, body: 'Unauthorized' };
    }

    const origin = process.env.ORIGIN || event.headers.host;
    const url = `https://${origin}/admin.html`;
    const resp = await fetch(url, { headers: { Accept: 'text/html' } });
    const text = await resp.text();
    return { statusCode: resp.status, headers: { 'content-type': 'text/html' }, body: text };
  } catch (err) {
    return { statusCode: 500, body: 'Function error' };
  }
};
