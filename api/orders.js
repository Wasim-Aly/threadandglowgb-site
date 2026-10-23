const { send, readBody, cleanText } = require('./_lib/http');
const { getConfig, supabaseRequest, consumeRateLimit, validOrigin } = require('./_lib/supabase');

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\+?[0-9\s().-]{7,20}$/;

module.exports = async function ordersHandler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed.' });
  if (!validOrigin(req)) return send(res, 403, { error: 'Submit the order using the store website.' });

  const config = getConfig();
  if (!config.configured) return send(res, 503, { error: 'Online order requests are not configured yet. Please contact the store directly.' });

  let body;
  try {
    body = readBody(req);
    if (JSON.stringify(body).length > 16000) return send(res, 413, { error: 'The order request is too large.' });
  } catch {
    return send(res, 400, { error: 'Please send a valid order request.' });
  }

  if (cleanText(body.website, 200)) return send(res, 400, { error: 'The order could not be submitted.' });
  const customerName = cleanText(body.name, 120);
  const city = cleanText(body.city, 120);
  const contactMethod = body.contactMethod === 'email' ? 'email' : body.contactMethod === 'whatsapp' ? 'whatsapp' : '';
  const contactValue = cleanText(body.contactValue, 254);
  const requestedVia = body.channel === 'email' ? 'email' : body.channel === 'whatsapp' ? 'whatsapp' : '';
  const address = cleanText(body.address, 500);
  const notes = cleanText(body.notes, 1000);
  const items = Array.isArray(body.items) ? body.items : [];

  if (!customerName || !city || !contactMethod || !requestedVia || items.length < 1 || items.length > 20) {
    return send(res, 400, { error: 'Please complete your name, city, contact details and order items.' });
  }
  if (contactMethod === 'email' ? !emailPattern.test(contactValue) : !phonePattern.test(contactValue)) {
    return send(res, 400, { error: contactMethod === 'email' ? 'Enter a valid email address.' : 'Enter a valid WhatsApp number, including its country code.' });
  }
  const contactDigits = contactValue.replace(/\D/g, '').length;
  if (contactMethod === 'whatsapp' && (contactDigits < 7 || contactDigits > 15)) {
    return send(res, 400, { error: 'Enter a valid WhatsApp number with 7 to 15 digits, including its country code.' });
  }
  if (items.some((item) => !Number.isSafeInteger(item.id) || item.id < 1 || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 99)) {
    return send(res, 400, { error: 'One or more product quantities are invalid.' });
  }

  const quantities = new Map();
  for (const item of items) quantities.set(item.id, (quantities.get(item.id) || 0) + item.quantity);
  if ([...quantities.values()].some((quantity) => quantity > 99)) {
    return send(res, 400, { error: 'A product quantity exceeds the order limit.' });
  }

  try {
    if (!(await consumeRateLimit(req, 'orders', 8))) {
      res.setHeader('Retry-After', '600');
      return send(res, 429, { error: 'Too many order requests. Please wait a few minutes and try again.' });
    }

    const ids = [...quantities.keys()];
    const filter = encodeURIComponent(`in.(${ids.join(',')})`);
    const products = await supabaseRequest(
      `/rest/v1/products?select=id,name,description,category,image_url,price,stock,is_active&id=${filter}`,
    );
    const productById = new Map(products.map((product) => [product.id, product]));
    const orderItems = [];
    let estimatedTotal = 0;
    let allPricesKnown = true;

    for (const [id, quantity] of quantities) {
      const product = productById.get(id);
      if (!product || !product.is_active) return send(res, 400, { error: 'A selected product is no longer available. Refresh the catalog and review your cart.' });
      if (product.stock !== null && product.stock < quantity) {
        return send(res, 409, { error: `${product.name} has fewer items available than requested. Please adjust the quantity.` });
      }
      const unitPrice = product.price === null ? null : Number(product.price);
      if (unitPrice === null) allPricesKnown = false;
      else estimatedTotal += unitPrice * quantity;
      orderItems.push({
        id: product.id,
        name: product.name,
        category: product.category,
        imageUrl: product.image_url,
        unitPrice,
        quantity,
      });
    }

    const inserted = await supabaseRequest('/rest/v1/orders?select=id,order_number,created_at', {
      method: 'POST',
      prefer: 'return=representation',
      body: {
        customer_name: customerName,
        contact_method: contactMethod,
        contact_value: contactValue,
        city,
        delivery_address: address,
        notes,
        requested_via: requestedVia,
        items: orderItems,
        estimated_total: allPricesKnown ? Number(estimatedTotal.toFixed(2)) : null,
      },
    });
    if (!Array.isArray(inserted) || !inserted[0]) throw new Error('The order was not saved.');
    return send(res, 201, { orderNumber: inserted[0].order_number });
  } catch (error) {
    if (error.status === 429) return send(res, 429, { error: 'Too many order requests. Please wait a few minutes and try again.' });
    console.error('Order request could not be saved.', { code: error.code || 'unknown' });
    return send(res, 502, { error: 'We could not save your order request. Your cart is still available; please try again.' });
  }
};
