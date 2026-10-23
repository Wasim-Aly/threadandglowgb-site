const { send, readBody, cleanText } = require('./_lib/http');
const { getConfig, supabaseRequest, consumeRateLimit, validOrigin } = require('./_lib/supabase');

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\+?[0-9\s().-]{7,20}$/;

module.exports = async function messagesHandler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed.' });
  if (!validOrigin(req)) return send(res, 403, { error: 'Submit your message using the store website.' });

  const config = getConfig();
  if (!config.configured) return send(res, 503, { error: 'The message service is not configured yet. Please use the WhatsApp or email links on the page.' });

  let body;
  try {
    body = readBody(req);
    if (JSON.stringify(body).length > 8000) return send(res, 413, { error: 'The message is too large.' });
  } catch {
    return send(res, 400, { error: 'Please send a valid message.' });
  }

  if (cleanText(body.website, 200)) return send(res, 400, { error: 'The message could not be submitted.' });
  const name = cleanText(body.name, 120);
  const message = cleanText(body.message, 2000);
  const replyContact = cleanText(body.replyContact, 254);
  const requestedVia = body.channel === 'email' ? 'email' : body.channel === 'whatsapp' ? 'whatsapp' : '';
  if (!name || !message || !requestedVia) return send(res, 400, { error: 'Please provide your name and a message.' });
  if (replyContact && !(emailPattern.test(replyContact) || (
    phonePattern.test(replyContact) &&
    replyContact.replace(/\D/g, '').length >= 7 &&
    replyContact.replace(/\D/g, '').length <= 15
  ))) {
    return send(res, 400, { error: 'Enter a valid email address or phone number, or leave the field blank.' });
  }

  try {
    if (!(await consumeRateLimit(req, 'messages', 12))) {
      res.setHeader('Retry-After', '600');
      return send(res, 429, { error: 'Too many messages. Please wait a few minutes and try again.' });
    }
    const inserted = await supabaseRequest('/rest/v1/inquiries?select=inquiry_number', {
      method: 'POST',
      prefer: 'return=representation',
      body: { customer_name: name, reply_contact: replyContact, requested_via: requestedVia, message },
    });
    if (!Array.isArray(inserted) || !inserted[0]) throw new Error('The message was not saved.');
    return send(res, 201, { inquiryNumber: inserted[0].inquiry_number });
  } catch (error) {
    if (error.status === 429) return send(res, 429, { error: 'Too many messages. Please wait a few minutes and try again.' });
    console.error('Customer inquiry could not be saved.', { code: error.code || 'unknown' });
    return send(res, 502, { error: 'We could not save your message. Please try again or contact the store directly.' });
  }
};
