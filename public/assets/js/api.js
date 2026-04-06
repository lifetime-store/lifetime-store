const CART_KEY = "lifetime_cart_v1";
const ADMIN_TOKEN_KEY = "lifetime_admin_token";

export async function apiGet(url, admin = false) {
  const headers = {};
  if (admin && getAdminToken()) headers["X-Admin-Token"] = getAdminToken();
  const res = await fetch(url, { headers, credentials: 'same-origin' });
  return parseJsonSafe(res);
}

export async function apiPost(url, payload, admin = false) {
  const headers = { "Content-Type": "application/json" };
  if (admin && getAdminToken()) headers["X-Admin-Token"] = getAdminToken();
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    credentials: 'same-origin'
  });
  return parseJsonSafe(res);
}

export async function apiPostForm(url, formData, admin = false) {
  const headers = {};
  if (admin && getAdminToken()) headers["X-Admin-Token"] = getAdminToken();
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: formData,
    credentials: 'same-origin'
  });
  return parseJsonSafe(res);
}

async function parseJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return { ok: res.ok, message: res.ok ? 'Request completed.' : 'Request failed.' };
  }
}

export function formatNGN(value) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

export function formatUSD(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

export function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveCart(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  updateCartCount();
}

export function addToCart(item) {
  const cart = getCart();
  const existing = cart.find((entry) => entry.key === item.key);
  if (existing) {
    const max = Number(item.stock || existing.stock || 9999);
    existing.quantity = Math.min(max, Number(existing.quantity || 0) + Number(item.quantity || 1));
    existing.stock = max;
  } else {
    cart.push(item);
  }
  saveCart(cart);
}

export function clearCart() {
  localStorage.removeItem(CART_KEY);
  updateCartCount();
}

export function updateCartCount() {
  const count = getCart().reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  document.querySelectorAll("[data-cart-count]").forEach((el) => {
    el.textContent = String(count);
  });
}

export function setAdminToken(token) {
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function clearAdminToken() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
}

export function getAdminToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY) || "";
}

export function qs(name) {
  return new URLSearchParams(window.location.search).get(name);
}

export function escapeHtml(input = "") {
  return String(input)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

document.addEventListener("DOMContentLoaded", updateCartCount);
