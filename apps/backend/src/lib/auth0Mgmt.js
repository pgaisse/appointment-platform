// Deriva domain/audience desde AUTH0_ISSUER_BASE_URL y usa AUTH0_AUDIENCE de tu API.
const fetch = global.fetch || require('node-fetch');

function issuerDomain() {
  const raw = process.env.AUTH0_ISSUER_BASE_URL || '';
  const u = new URL(raw.endsWith('/') ? raw : raw + '/');
  return u.hostname; // p.ej. dev-w2lewd1si042sauk.us.auth0.com
}

function mgmtAudience() {
  return `https://${issuerDomain()}/api/v2/`;
}

let cache = { token: null, exp: 0 };

async function getMgmtToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cache.token && now < cache.exp - 60) return cache.token;

  const res = await fetch(`https://${issuerDomain()}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: process.env.AUTH0_MGMT_CLIENT_ID,
      client_secret: process.env.AUTH0_MGMT_CLIENT_SECRET,
      audience: mgmtAudience(),
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Mgmt token ${res.status}: ${JSON.stringify(data)}`);

  cache.token = data.access_token;
  cache.exp = now + (data.expires_in || 3600);
  return cache.token;
}

async function callMgmt(path, opts = {}) {
  const token = await getMgmtToken();
  const url = `https://${issuerDomain()}/api/v2${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Mgmt ${path} -> ${res.status}: ${JSON.stringify(out)}`);
  return out;
}

module.exports = { callMgmt };
