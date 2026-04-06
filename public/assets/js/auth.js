import { apiGet, apiPost, clearCart, getCustomer, loadCustomer, saveCart, setCustomer, syncCartFromServer } from './api.js';

function setNotice(html) {
  const el = document.querySelector('[data-auth-notice]');
  if (el) el.innerHTML = html;
}

async function handleRegister(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  const payload = {
    full_name: form.full_name.value,
    email: form.email.value,
    password: form.password.value
  };
  const result = await apiPost('/api/auth/register', payload);
  if (result.ok && result.customer) {
    setCustomer(result.customer);
    await syncCartFromServer();
    window.location.href = '/account.html?created=1';
    return;
  }
  setNotice(`<div class="notice notice-danger">${result.message || 'Could not create account.'}</div>`);
  button.disabled = false;
}

async function handleLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  const result = await apiPost('/api/auth/login', {
    email: form.email.value,
    password: form.password.value
  });
  if (result.ok && result.customer) {
    setCustomer(result.customer);
    await syncCartFromServer();
    window.location.href = '/account.html?login=1';
    return;
  }
  setNotice(`<div class="notice notice-danger">${result.message || 'Sign in failed.'}</div>`);
  button.disabled = false;
}

async function handleLogout() {
  await apiPost('/api/auth/logout', {});
  setCustomer(null);
  await clearCart();
  saveCart([]);
  window.location.href = '/login.html?logout=1';
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
  document.querySelector('[data-register-form]')?.addEventListener('submit', handleRegister);
  document.querySelector('[data-login-form]')?.addEventListener('submit', handleLogin);
  renderAccount();
});
