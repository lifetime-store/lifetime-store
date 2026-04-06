import { apiGet, apiPost, clearCart, loadCustomer, saveCart, setCustomer, syncCartFromServer, qs } from './api.js';

function setNotice(html) {
  const el = document.querySelector('[data-auth-notice]');
  if (el) el.innerHTML = html;
}

function getFormValue(form, name) {
  return String(new FormData(form).get(name) || '').trim();
}

function setButtonState(button, busy, busyText, idleText) {
  if (!button) return;
  button.disabled = busy;
  button.textContent = busy ? busyText : idleText;
}

async function handleRegister(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  setNotice('');
  setButtonState(button, true, 'Creating account...', 'Create account');

  const payload = {
    full_name: getFormValue(form, 'full_name'),
    email: getFormValue(form, 'email').toLowerCase(),
    password: getFormValue(form, 'password')
  };

  if (!payload.email || !payload.password) {
    setNotice(`<div class="notice notice-danger">Email and password are required.</div>`);
    setButtonState(button, false, 'Creating account...', 'Create account');
    return;
  }

  try {
    const result = await apiPost('/api/auth/register', payload);
    if (result.ok && result.customer) {
      setCustomer(result.customer);
      await syncCartFromServer();
      window.location.href = '/account.html?created=1';
      return;
    }
    const missingTables = result.message && /no such table|customers|customer_sessions|cart_items/i.test(result.message);
    setNotice(`<div class="notice notice-danger">${missingTables ? 'Account tables are not ready yet. Run migration 0003_accounts_cart.sql in D1, then try again.' : (result.message || 'Could not create account.')}</div>`);
  } catch (error) {
    setNotice(`<div class="notice notice-danger">Could not create account right now. Please try again.</div>`);
  }
  setButtonState(button, false, 'Creating account...', 'Create account');
}

async function handleLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  setNotice('');
  setButtonState(button, true, 'Signing in...', 'Sign in');

  try {
    const result = await apiPost('/api/auth/login', {
      email: getFormValue(form, 'email').toLowerCase(),
      password: getFormValue(form, 'password')
    });
    if (result.ok && result.customer) {
      setCustomer(result.customer);
      await syncCartFromServer();
      window.location.href = '/account.html?login=1';
      return;
    }
    const missingTables = result.message && /no such table|customers|customer_sessions|cart_items/i.test(result.message);
    setNotice(`<div class="notice notice-danger">${missingTables ? 'Account tables are not ready yet. Run migration 0003_accounts_cart.sql in D1, then try again.' : (result.message || 'Sign in failed.')}</div>`);
  } catch (error) {
    setNotice(`<div class="notice notice-danger">Sign in failed. Please try again.</div>`);
  }
  setButtonState(button, false, 'Signing in...', 'Sign in');
}

async function handleLogout() {
  await apiPost('/api/auth/logout', {});
  setCustomer(null);
  await clearCart();
  saveCart([]);
  window.location.href = '/login.html?logout=1';
}

function renderQueryNotice() {
  const created = qs('created');
  const login = qs('login');
  const logout = qs('logout');
  if (created === '1') setNotice(`<div class="notice notice-success">Your account was created successfully.</div>`);
  if (login === '1') setNotice(`<div class="notice notice-success">Signed in successfully.</div>`);
  if (logout === '1') setNotice(`<div class="notice notice-success">You have been logged out.</div>`);
}

async function renderAccount() {
  const mount = document.querySelector('[data-account-state]');
  if (!mount) return;

  const customer = await loadCustomer();
  if (!customer) {
    mount.innerHTML = `
      <div class="notice notice-warning">You are not signed in.</div>
      <div class="inline-actions">
        <a class="btn btn-primary" href="/login.html">Sign in</a>
        <a class="btn btn-soft" href="/register.html">Create account</a>
      </div>
    `;
    return;
  }

  const cartResult = await apiGet('/api/cart');
  const itemCount = Array.isArray(cartResult.items) ? cartResult.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0) : 0;
  mount.innerHTML = `
    <div class="notice notice-success">Signed in successfully.</div>
    <div class="details-list">
      <article><strong>Name</strong><p class="muted">${customer.full_name || 'Not set yet'}</p></article>
      <article><strong>Email</strong><p class="muted">${customer.email}</p></article>
      <article><strong>Premium level</strong><p class="muted">${customer.tier_name || 'Classic'}${Number(customer.tier_discount_percent || 0) ? ` · auto discount ${customer.tier_discount_percent}%` : ''}</p></article>
      <article><strong>Loyalty points</strong><p class="muted">${Number(customer.loyalty_points || 0)} point(s)</p></article>
      <article><strong>Saved cart items</strong><p class="muted">${itemCount} item${itemCount === 1 ? '' : 's'} linked to your account.</p></article>
    </div>
    <div class="inline-actions">
      <a class="btn btn-primary" href="/shop.html">Continue shopping</a>
      <a class="btn btn-soft" href="/checkout.html">Go to checkout</a>
      <button class="btn btn-danger" type="button" data-logout-btn>Log out</button>
    </div>
  `;
  mount.querySelector('[data-logout-btn]')?.addEventListener('click', handleLogout);
}

document.addEventListener('DOMContentLoaded', () => {
  renderQueryNotice();
  document.querySelector('[data-register-form]')?.addEventListener('submit', handleRegister);
  document.querySelector('[data-login-form]')?.addEventListener('submit', handleLogin);
  renderAccount();
});
