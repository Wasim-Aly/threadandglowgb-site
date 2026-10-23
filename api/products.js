const { getConfig, supabaseRequest } = require('./_lib/supabase');
const { send } = require('./_lib/http');

module.exports = async function productsHandler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed.' });
  const config = getConfig();
  if (!config.configured) return send(res, 503, { error: 'Online catalog is not configured yet.' });

  try {
    const rows = await supabaseRequest(
      '/rest/v1/products?select=id,name,description,category,image_url,price,stock,sort_order&is_active=eq.true&order=sort_order.asc,name.asc',
      { key: config.anonKey },
    );
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    return send(res, 200, {
      products: rows.map((product) => ({
        ...product,
        available: product.stock === null || product.stock > 0,
      })),
    });
  } catch (error) {
    console.error('Public catalog request failed.', { code: error.code || 'unknown' });
    return send(res, 502, { error: 'The catalog is temporarily unavailable. Please try again shortly.' });
  }
};
