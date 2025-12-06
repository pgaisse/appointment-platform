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

// Cache for API responses to reduce rate limit issues
const responseCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCacheKey(path, method = 'GET') {
  return `${method}:${path}`;
}

function getCachedResponse(path, method = 'GET') {
  const key = getCacheKey(path, method);
  const cached = responseCache.get(key);
  if (!cached) return null;
  
  const now = Date.now();
  if (now > cached.expires) {
    responseCache.delete(key);
    return null;
  }
  
  return cached.data;
}

function setCachedResponse(path, data, method = 'GET', ttl = CACHE_TTL) {
  const key = getCacheKey(path, method);
  responseCache.set(key, {
    data,
    expires: Date.now() + ttl,
  });
}

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
  const method = opts.method || 'GET';
  
  // Only cache GET requests
  if (method === 'GET') {
    const cached = getCachedResponse(path, method);
    if (cached) {
      console.log(`[Auth0 Cache HIT] ${path}`);
      return cached;
    }
  }

  const token = await getMgmtToken();
  const url = `https://${issuerDomain()}/api/v2${path}`;
  
  try {
    const res = await fetch(url, {
      ...opts,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
        ...(opts.headers || {}),
      },
    });
    const out = await res.json().catch(() => ({}));
    
    if (!res.ok) {
      // Handle rate limiting specifically
      if (res.status === 429) {
        console.error(`[Auth0 Rate Limit] ${path} - Too many requests`);
        throw new Error(`Auth0 rate limit exceeded. Please try again in a moment.`);
      }
      throw new Error(`Mgmt ${path} -> ${res.status}: ${JSON.stringify(out)}`);
    }
    
    // Cache successful GET responses
    if (method === 'GET') {
      setCachedResponse(path, out, method);
      console.log(`[Auth0 Cache SET] ${path}`);
    }
    
    return out;
  } catch (error) {
    // If it's a rate limit error, try to return cached data even if expired
    if (error.message.includes('rate limit')) {
      const key = getCacheKey(path, method);
      const staleCache = responseCache.get(key);
      if (staleCache) {
        console.warn(`[Auth0 Cache STALE] Using expired cache for ${path} due to rate limit`);
        return staleCache.data;
      }
    }
    throw error;
  }
}

module.exports = { callMgmt };
