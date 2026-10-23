const { createHash } = require('node:crypto');

function getConfig() {
  const url = process.env.SUPABASE_URL || '';
  const anonKey = process.env.SUPABASE_ANON_KEY || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return {
    url: url.replace(/\/+$/, ''),
    anonKey,
    serviceRoleKey,
    configured: Boolean(url && anonKey && serviceRoleKey),
  };
}

async function supabaseRequest(path, options = {}) {
  const config = getConfig();
  const key = options.key || config.serviceRoleKey;
  if (!config.url || !key) throw new Error('Supabase server configuration is incomplete.');

  const response = await fetch(`${config.url}${path}`, {
    method: options.method || 'GET',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(options.prefer ? { Prefer: options.prefer } : {}),
    },
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
