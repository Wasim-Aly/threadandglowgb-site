const { getConfig } = require('./_lib/supabase');
const { send } = require('./_lib/http');

module.exports = function configHandler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed.' });
  const config = getConfig();
  return send(res, 200, {
    configured: config.configured,
    supabaseUrl: config.configured ? config.url : '',
    supabaseAnonKey: config.configured ? config.anonKey : '',
  });
};
