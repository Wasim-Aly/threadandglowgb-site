const { createHash } = require('node:crypto');

function jwtHasRole(key, role) {
  const parts = key.split('.');
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return payload.role === role;
  } catch {
    return false;
  }
}

function getConfig() {
  const url = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const anonKey = process.env.SUPABASE_ANON_KEY || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  let validUrl = false;
  try {
    const parsedUrl = new URL(url);
    validUrl = parsedUrl.protocol === 'https:' && Boolean(parsedUrl.hostname) &&
      !parsedUrl.username && !parsedUrl.password &&
      !/your-project|placeholder|supabase project url/i.test(url);
  } catch {}
  const validAnonKey = anonKey.startsWith('sb_publishable_') || jwtHasRole(anonKey, 'anon');
  const validServiceRoleKey = serviceRoleKey.startsWith('sb_secret_') || jwtHasRole(serviceRoleKey, 'service_role');
  return {
    url,
    anonKey,
    serviceRoleKey,
    configured: validUrl && validAnonKey && validServiceRoleKey,
  };
}

async function supabaseRequest(path, options = {}) {
  const config = getConfig();
  const key = options.key || config.serviceRoleKey;
  if (!config.url || !key) throw new Error('Supabase server configuration is incomplete.');

  const headers = {
    apikey: key,
    'Content-Type': 'application/json',
    ...(options.prefer ? { Prefer: options.prefer } : {}),
  };
  if (key.split('.').length === 3) headers.Authorization = `Bearer ${key}`;

  const response = await fetch(`${config.url}${path}`, {
    method: options.method || 'GET',
    headers,
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('Supabase returned an invalid response.');
    }
  }

  if (!response.ok) {
    const error = new Error('Supabase request failed.');
    error.status = response.status;
    error.code = data && (data.code || data.error_code);
    throw error;
  }
  return data;
}

async function consumeRateLimit(req, action, maxRequests) {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '') ||
    req.socket?.remoteAddress ||
    'unknown';
  const identifier = createHash('sha256').update(`${action}:${ip}`).digest('hex');
  const result = await supabaseRequest('/rest/v1/rpc/consume_public_rate_limit', {
    method: 'POST',
    body: { p_identifier: identifier, p_max_requests: maxRequests, p_window_seconds: 600 },
  });
  return result === true;
}

function validOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return false;
  try {
    const originUrl = new URL(origin);
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    return Boolean(host && originUrl.host.toLowerCase() === String(host).toLowerCase());
  } catch {
    return false;
  }
}

module.exports = { getConfig, supabaseRequest, consumeRateLimit, validOrigin };
