const $ = (selector, root = document) => root.querySelector(selector);
const views = ['orders', 'inquiries', 'products'];
let config;
let accessToken;
let currentUser;
let orders = [];
let inquiries = [];
let products = [];

function setStatus(target, message, error = false) {
  const element = $(target);
  element.textContent = message;
  element.classList.toggle('error', error);
}

async function readResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.msg || 'The request failed. Please try again.');
  return data;
}

async function supabase(path, options = {}) {
  const response = await fetch(`${config.supabaseUrl}${path}`, {
    method: options.method || 'GET',
    headers: {
      apikey: config.supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.prefer ? { Prefer: options.prefer } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
  return readResponse(response);
}

async function loadConfiguration() {
  try {
    const response = await fetch('/api/config', { cache: 'no-store' });
    config = await readResponse(response);
    if (!config.configured) {
      $('#setup-notice').hidden = false;
      return;
    }
    $('#setup-notice').hidden = true;
    $('#login-panel').hidden = false;
  } catch {
    $('#setup-notice').hidden = false;
  }
}

async function signIn(event) {
  event.preventDefault();
  const button = $('#login-form button[type="submit"]');
  button.disabled = true;
  setStatus('#login-status', 'Signing in…');
  try {
    const response = await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: config.supabaseAnonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: $('#login-email').value.trim(), password: $('#login-password').value }),
    });
    const session = await readResponse(response);
    if (!session.access_token || !session.user?.id) throw new Error('Sign-in did not return a valid session.');
    accessToken = session.access_token;
    currentUser = session.user;
    const membership = await supabase(`/rest/v1/admin_users?select=user_id&user_id=eq.${encodeURIComponent(currentUser.id)}&limit=1`);
    if (!membership.length) {
      await fetch(`${config.supabaseUrl}/auth/v1/logout`, {
        method: 'POST',
        headers: { apikey: config.supabaseAnonKey, Authorization: `Bearer ${accessToken}` },
      });
      accessToken = null;
      currentUser = null;
      throw new Error('This account is not enabled as a store administrator.');
    }
    $('#login-form').reset();
    $('#login-panel').hidden = true;
    $('#dashboard').hidden = false;
    $('#admin-identity').textContent = currentUser.email || '';
    await refreshDashboard();
  } catch (error) {
    setStatus('#login-status', error.message || 'Could not sign in. Check your details and try again.', true);
  } finally {
    button.disabled = false;
  }
}

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? 'Date unavailable' : date.toLocaleString();
}

function emptyState(message) {
  return `<p class="empty-state">${escapeHTML(message)}</p>`;
}

function productImageSource(value) {
  const source = String(value ?? '').trim();
  if (/^https:\/\//i.test(source) || source.startsWith('/') || source.startsWith('../')) return source;
  return `../${source}`;
}

function statusControl(record, type, statuses) {
  return `<label>Status<select data-record-type="${type}" data-record-id="${escapeHTML(record.id)}">${statuses.map((status) =>
    `<option value="${status}"${record.status === status ? ' selected' : ''}>${status[0].toUpperCase()}${status.slice(1)}</option>`,
  ).join('')}</select></label>`;
}

function renderOrders() {
  const filter = $('#order-filter').value;
  const filtered = orders.filter((order) => filter === 'all' || order.status === filter);
  $('#orders-count').textContent = orders.filter((order) => order.status === 'new').length || '';
  $('#orders-list').innerHTML = filtered.length ? filtered.map((order) => {
    const itemLines = Array.isArray(order.items) ? order.items.map((item) =>
      `<li>${escapeHTML(item.name)} × ${Number(item.quantity) || 0}${item.unitPrice === null ? ' — price to confirm' : ` — Rs ${Number(item.unitPrice).toLocaleString()}`}</li>`,
    ).join('') : '';
    const contactHref = order.contact_method === 'email'
      ? `mailto:${encodeURIComponent(order.contact_value)}`
      : `https://wa.me/${String(order.contact_value).replace(/\D/g, '')}`;
    return `<article class="record"><div class="record-header"><div><h3>${escapeHTML(order.order_number)} · ${escapeHTML(order.customer_name)}</h3><div class="record-meta">${escapeHTML(formatDate(order.created_at))} · Request via ${escapeHTML(order.requested_via)} · ${escapeHTML(order.city)}</div></div><a class="contact-action" href="${escapeHTML(contactHref)}">${escapeHTML(order.contact_value)}</a></div><ul class="record-items">${itemLines}</ul>${order.delivery_address ? `<p><strong>Delivery address:</strong> ${escapeHTML(order.delivery_address)}</p>` : ''}${order.notes ? `<p><strong>Notes:</strong> ${escapeHTML(order.notes)}</p>` : ''}<p><strong>Estimated total:</strong> ${order.estimated_total === null ? 'Confirm with customer' : `Rs ${Number(order.estimated_total).toLocaleString()}`}</p><div class="record-actions">${statusControl(order, 'orders', ['new', 'reviewing', 'confirmed', 'fulfilled', 'cancelled'])}</div></article>`;
  }).join('') : emptyState(filter === 'all' ? 'No order requests have been received yet.' : `No ${filter} orders.`);
}

function renderInquiries() {
  const filter = $('#inquiry-filter').value;
  const filtered = inquiries.filter((inquiry) => filter === 'all' || inquiry.status === filter);
  $('#inquiries-count').textContent = inquiries.filter((inquiry) => inquiry.status === 'new').length || '';
  $('#inquiries-list').innerHTML = filtered.length ? filtered.map((inquiry) => {
    const contact = inquiry.reply_contact || '';
    const emailContact = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact);
    const phoneContact = /^\+?[0-9\s().-]{7,20}$/.test(contact) &&
      contact.replace(/\D/g, '').length >= 7 &&
      contact.replace(/\D/g, '').length <= 15;
    const contactHref = emailContact
      ? `mailto:${encodeURIComponent(contact)}`
      : phoneContact ? `https://wa.me/${contact.replace(/\D/g, '')}` : '';
    const contactDisplay = contact
      ? contactHref
        ? `<a class="contact-action" href="${escapeHTML(contactHref)}">${escapeHTML(contact)}</a>`
        : `<span class="contact-action">${escapeHTML(contact)}</span>`
      : '';
    return `<article class="record"><div class="record-header"><div><h3>${escapeHTML(inquiry.inquiry_number)} · ${escapeHTML(inquiry.customer_name)}</h3><div class="record-meta">${escapeHTML(formatDate(inquiry.created_at))} · Customer chose ${escapeHTML(inquiry.requested_via)}</div></div>${contactDisplay}</div><p class="record-body">${escapeHTML(inquiry.message)}</p><div class="record-actions">${statusControl(inquiry, 'inquiries', ['new', 'replied', 'closed'])}</div></article>`;
  }).join('') : emptyState(filter === 'all' ? 'No website enquiries have been received yet.' : `No ${filter} messages.`);
}

function productCard(product) {
  return `<form class="record product-card" data-product-id="${product.id}"><img src="${escapeHTML(productImageSource(product.image_url))}" alt=""><div class="product-fields"><label>Name<input name="name" value="${escapeHTML(product.name)}" maxlength="120" required></label><label>Category<select name="category">${['Salt Lamps', 'Crochet Bags', 'Flowers & Decor', 'Keychains'].map((category) => `<option${product.category === category ? ' selected' : ''}>${category}</option>`).join('')}</select></label><label>Description<textarea name="description" maxlength="2000" rows="2">${escapeHTML(product.description)}</textarea></label><label class="wide">Image path<input name="image_url" value="${escapeHTML(product.image_url)}" maxlength="500" required></label><label>Price (PKR)<input name="price" type="number" min="0" step="0.01" value="${product.price ?? ''}" placeholder="Ask for price"></label><label>Stock<input name="stock" type="number" min="0" step="1" value="${product.stock ?? ''}" placeholder="Not tracked"></label><label>Display order<input name="sort_order" type="number" step="1" value="${Number(product.sort_order) || 0}"></label><label>Visible<select name="is_active"><option value="true"${product.is_active ? ' selected' : ''}>Yes</option><option value="false"${!product.is_active ? ' selected' : ''}>No</option></select></label></div><div class="product-footer"><span class="record-meta">Product #${product.id}</span><button class="button" type="submit">Save product</button></div></form>`;
}

function renderProducts() {
  $('#products-list').innerHTML = products.length ? products.map(productCard).join('') : emptyState('No products yet. Add your first product above.');
}

async function refreshDashboard() {
  setStatus('#dashboard-status', 'Loading store data…');
  try {
    [orders, inquiries, products] = await Promise.all([
      supabase('/rest/v1/orders?select=*&order=created_at.desc&limit=100'),
      supabase('/rest/v1/inquiries?select=*&order=created_at.desc&limit=100'),
      supabase('/rest/v1/products?select=*&order=sort_order.asc,name.asc&limit=250'),
    ]);
    renderOrders();
    renderInquiries();
    renderProducts();
    setStatus('#dashboard-status', 'Store data is up to date.');
  } catch (error) {
    setStatus('#dashboard-status', error.message || 'Could not load store data. Check the database setup and your connection.', true);
  }
}

async function updateRecord(type, id, status, select) {
  select.disabled = true;
  try {
    const table = type === 'orders' ? 'orders' : 'inquiries';
    await supabase(`/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      prefer: 'return=minimal',
      body: { status },
    });
    setStatus('#dashboard-status', `${type === 'orders' ? 'Order' : 'Message'} status updated.`);
    await refreshDashboard();
  } catch (error) {
    setStatus('#dashboard-status', error.message || 'Could not update status.', true);
    select.disabled = false;
  }
}

function productPayload(form) {
  const data = new FormData(form);
  const priceValue = String(data.get('price')).trim();
  const stockValue = String(data.get('stock')).trim();
  const payload = {
    name: String(data.get('name')).trim(),
    category: data.get('category'),
    description: String(data.get('description')).trim(),
    image_url: String(data.get('image_url')).trim(),
    price: priceValue === '' ? null : Number(priceValue),
    stock: stockValue === '' ? null : Number(stockValue),
    sort_order: Number(data.get('sort_order')) || 0,
    is_active: data.get('is_active') !== 'false',
  };
  if (payload.price !== null && (!Number.isFinite(payload.price) || payload.price < 0)) throw new Error('Enter a valid non-negative price.');
  if (payload.stock !== null && (!Number.isSafeInteger(payload.stock) || payload.stock < 0)) throw new Error('Stock must be a whole number of zero or more.');
  return payload;
}

async function saveProduct(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = $('button[type="submit"]', form);
  button.disabled = true;
  try {
    const payload = productPayload(form);
    const id = form.dataset.productId;
    if (id) {
      await supabase(`/rest/v1/products?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', prefer: 'return=minimal', body: payload });
      setStatus('#dashboard-status', 'Product saved.');
    } else {
      await supabase('/rest/v1/products', { method: 'POST', prefer: 'return=minimal', body: payload });
      form.reset();
      form.elements.sort_order.value = '0';
      setStatus('#dashboard-status', 'Product added to the catalog.');
    }
    await refreshDashboard();
  } catch (error) {
    setStatus('#dashboard-status', error.message || 'Could not save the product.', true);
    button.disabled = false;
  }
}

function selectView(view) {
  views.forEach((name) => {
    $(`#${name}-view`).hidden = name !== view;
    $(`.tab[data-view="${name}"]`).classList.toggle('active', name === view);
  });
}

async function signOut() {
  if (accessToken) {
    await fetch(`${config.supabaseUrl}/auth/v1/logout`, {
      method: 'POST',
      headers: { apikey: config.supabaseAnonKey, Authorization: `Bearer ${accessToken}` },
    }).catch(() => {});
  }
  accessToken = null;
  currentUser = null;
  orders = [];
  inquiries = [];
  products = [];
  $('#dashboard').hidden = true;
  $('#login-panel').hidden = false;
  setStatus('#login-status', 'You have signed out.');
}

$('#login-form').addEventListener('submit', signIn);
$('#logout-button').addEventListener('click', signOut);
$('#refresh-button').addEventListener('click', refreshDashboard);
$('#order-filter').addEventListener('change', renderOrders);
$('#inquiry-filter').addEventListener('change', renderInquiries);
$('#new-product-form').addEventListener('submit', saveProduct);
document.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => selectView(tab.dataset.view)));
document.addEventListener('change', (event) => {
  const select = event.target.closest('select[data-record-type]');
  if (select) updateRecord(select.dataset.recordType, select.dataset.recordId, select.value, select);
});
document.addEventListener('submit', (event) => {
  if (event.target.matches('form[data-product-id]')) saveProduct(event);
});

loadConfiguration();
