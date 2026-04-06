const CART_KEY = 'lifetime_cart_v2';
const ADMIN_TOKEN_KEY = 'lifetime_admin_token';
const CUSTOMER_KEY = 'lifetime_customer';

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
  if (admin) headers['X-Admin-Token'] = getAdminToken();
  const res = await fetch(url, { headers, credentials: 'include' });
  return readJsonSafe(res);
}

export async function apiPost(url, payload, admin = false) {
  const headers = { 'Content-Type': 'application/json' };
  if (admin) headers['X-Admin-Token'] = getAdminToken();
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
  if (admin) headers['X-Admin-Token'] = getAdminToken();
  const res = await fetch(url, {
    method: 'DELETE',
    headers,
    credentials: 'include',
    body: JSON.stringify(payload)
  });
  return readJsonSafe(res);
}

export function formatNGN(value) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Number(value || 0));
}

export function formatUSD(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(Number(value || 0));
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
export function getAdminToken() { return localStorage.getItem(ADMIN_TOKEN_KEY) || ''; }
export function qs(name) { return new URLSearchParams(window.location.search).get(name); }

export function escapeHtml(input = '') {
  return String(input).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
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

document.addEventListener('DOMContentLoaded', async () => {
  updateCartCount();
  updateAccountLinks();
  try { await loadCustomer(); } catch {}
});
