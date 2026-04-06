const CART_KEY = 'lifetime_cart_v3';
const ADMIN_TOKEN_KEY = 'lifetime_admin_token';
const CUSTOMER_KEY = 'lifetime_customer';
let storefrontMetaPromise = null;

async function readJsonSafe(res) {
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      const data = await res.json();
      if (typeof data.ok === 'undefined') data.ok = res.ok;
      data.status = res.status;
      return data;
    } catch {
      return { ok: false, status: res.status, message: 'Invalid server response.' };
    }
  }
  try {
    const text = await res.text();
    return { ok: res.ok, status: res.status, message: text || (res.ok ? 'Request completed.' : 'Request failed.') };
  } catch {
    return { ok: false, status: res.status, message: 'Request failed.' };
  }
}

export async function apiGet(url, admin = false) {
  const headers = {};
  if (admin && getAdminToken()) headers['X-Admin-Token'] = getAdminToken();
  const res = await fetch(url, { headers, credentials: 'include' });
  return readJsonSafe(res);
}

export async function apiPost(url, payload, admin = false) {
  const headers = { 'Content-Type': 'application/json' };
  if (admin && getAdminToken()) headers['X-Admin-Token'] = getAdminToken();
  const res = await fetch(url, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(payload)
  });
  return readJsonSafe(res);
}

export async function apiDelete(url, payload = {}, admin = false) {
  const headers = { 'Content-Type': 'application/json' };
  if (admin && getAdminToken()) headers['X-Admin-Token'] = getAdminToken();
  const res = await fetch(url, {
    method: 'DELETE',
    headers,
    credentials: 'include',
    body: JSON.stringify(payload)
  });
  return readJsonSafe(res);
}

export async function apiPostForm(url, formData, admin = false) {
  const headers = {};
  if (admin && getAdminToken()) headers['X-Admin-Token'] = getAdminToken();
  const res = await fetch(url, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: formData
  });
  return readJsonSafe(res);
}

export function formatMoney(value, currency = 'USD', locale = 'en-US', maximumFractionDigits = 0) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits
  }).format(Number(value || 0));
}

export function formatNGN(value) {
  return formatMoney(value, 'NGN', 'en-NG', 0);
}

export function formatUSD(value) {
  return formatMoney(value, 'USD', 'en-US', 2);
}

export async function getStorefrontMeta(force = false) {
  if (!storefrontMetaPromise || force) {
    storefrontMetaPromise = apiGet('/api/meta/storefront').then((result) => result.meta || {
      country: 'NG',
      currency: 'NGN',
      locale: 'en-NG',
      usdRate: 1550,
      promotion: null,
      storeNotice: '',
      storeNoticeBadge: 'Store notice',
      verifyScannerHint: 'Use your phone camera on the cloth label. If camera access is denied, you can still enter the code manually.'
    });
  }
  return storefrontMetaPromise;
}

export async function localizePriceFromUSD(usdValue, compareAtUSD = null) {
  const meta = await getStorefrontMeta();
  const rate = Number(meta.usdRate || 1);
  const value = Number(usdValue || 0) * rate;
  const compareValue = compareAtUSD ? Number(compareAtUSD || 0) * rate : null;
  return {
    currency: meta.currency,
    locale: meta.locale,
    country: meta.country,
    value,
    compareValue,
    formatted: formatMoney(value, meta.currency, meta.locale, meta.currency === 'USD' ? 2 : 0),
    formattedCompare: compareValue ? formatMoney(compareValue, meta.currency, meta.locale, meta.currency === 'USD' ? 2 : 0) : ''
  };
}

export function getCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch { return []; }
}

export function saveCart(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  updateCartCount();
}

export async function saveCartAndSync(items) {
  saveCart(items);
  if (getCustomer()) {
    await apiPost('/api/cart', { items });
  }
}

export async function addToCart(item) {
  const cart = getCart();
  const existing = cart.find((entry) => entry.key === item.key);
  if (existing) {
    const max = Number(item.stock || existing.stock || 9999);
    existing.quantity = Math.min(max, Number(existing.quantity || 0) + Number(item.quantity || 1));
    existing.stock = max;
  } else {
    cart.push(item);
  }
  await saveCartAndSync(cart);
}

export async function removeCartItem(key) {
  const cart = getCart().filter((item) => item.key !== key);
  saveCart(cart);
  if (getCustomer()) {
    await apiDelete('/api/cart', { key });
  }
  updateCartCount();
  return cart;
}

export async function clearCart() {
  localStorage.removeItem(CART_KEY);
  if (getCustomer()) {
    await apiDelete('/api/cart');
  }
  updateCartCount();
}

export function updateCartCount() {
  const count = getCart().reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  document.querySelectorAll('[data-cart-count]').forEach((el) => { el.textContent = String(count); });
}

export function setAdminToken(token) { localStorage.setItem(ADMIN_TOKEN_KEY, token); }
export function clearAdminToken() { localStorage.removeItem(ADMIN_TOKEN_KEY); }
export function getAdminToken() { return localStorage.getItem(ADMIN_TOKEN_KEY) || ''; }
export function qs(name) { return new URLSearchParams(window.location.search).get(name); }

export function escapeHtml(input = '') {
  return String(input)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function getCustomer() {
  try { return JSON.parse(localStorage.getItem(CUSTOMER_KEY) || 'null'); } catch { return null; }
}

export function setCustomer(customer) {
  if (customer) localStorage.setItem(CUSTOMER_KEY, JSON.stringify(customer));
  else localStorage.removeItem(CUSTOMER_KEY);
  updateAccountLinks();
}

export async function loadCustomer() {
  const result = await apiGet('/api/auth/me');
  if (result.authenticated && result.customer) {
    setCustomer(result.customer);
    await syncCartFromServer();
    return result.customer;
  }
  setCustomer(null);
  return null;
}

export async function syncCartFromServer() {
  if (!getCustomer()) return getCart();
  const local = getCart();
  if (local.length) {
    await apiPost('/api/cart', { items: local });
  }
  const result = await apiGet('/api/cart');
  if (result.ok && Array.isArray(result.items)) {
    saveCart(result.items);
    return result.items;
  }
  return local;
}

export function updateAccountLinks() {
  const customer = getCustomer();
  document.querySelectorAll('[data-account-link]').forEach((el) => {
    el.textContent = customer ? (customer.full_name || customer.email.split('@')[0] || 'Account') : 'Account';
  });
}

export async function renderStorefrontBanner() {
  const meta = await getStorefrontMeta();
  document.querySelectorAll('[data-storefront-banner]').forEach((el) => {
    const promo = meta.promotion;
    const parts = [];
    if (promo?.banner_text) parts.push(escapeHtml(promo.banner_text));
    if (meta.storeNotice) parts.push(escapeHtml(meta.storeNotice));
    if (!parts.length) {
      el.classList.add('hide');
      return;
    }
    const badge = promo?.badge_text || meta.storeNoticeBadge || '';
    el.classList.remove('hide');
    el.innerHTML = `<div class="container banner-inner"><strong>${badge ? escapeHtml(badge) + ' · ' : ''}${parts.join(' ')}</strong></div>`;
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  updateCartCount();
  updateAccountLinks();
  renderStorefrontBanner();
  try { await loadCustomer(); } catch {}
});
