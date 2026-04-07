import { apiPost, clearCart, formatNGN, getCart, getCustomer, getStorefrontMeta, loadCustomer, localizePriceFromUSD, qs } from './api.js';

let checkoutContext = { subtotal: 0, promoDiscount: 0, tierDiscount: 0, promoCode: '' };

async function renderOrderPreview() {
  const cart = getCart();
  const mount = document.querySelector('[data-checkout-items]');
  const totalEl = document.querySelector('[data-checkout-total]');
  const localEl = document.querySelector('[data-checkout-total-local]');
  if (!mount) return false;
  if (!cart.length) {
    mount.innerHTML = `<div class="notice notice-warning">Your cart is empty. Add products first.</div>`;
    if (totalEl) totalEl.textContent = formatNGN(0);
    if (localEl) localEl.textContent = '';
    return false;
  }

  const subtotal = cart.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
  checkoutContext.subtotal = subtotal;
  mount.innerHTML = cart.map((item) => `
    <article class="cart-item">
      <strong>${item.product_name}</strong>
      <span class="muted">${item.color} / ${item.size}</span>
      <span class="muted">Qty: ${item.quantity}</span>
      <span>${formatNGN(item.unit_price * item.quantity)}</span>
    </article>
  `).join('');
  await updateTotals();
  return true;
}

function setNotice(html) {
  const notice = document.querySelector('[data-checkout-notice]');
  if (notice) notice.innerHTML = html;
}

async function prefillCustomer() {
  const customer = await loadCustomer() || getCustomer();
  const form = document.querySelector('[data-checkout-form]');
  if (!form || !customer) return;
  if (!form.email.value) form.email.value = customer.email || '';
  if (!form.customer_name.value) form.customer_name.value = customer.full_name || '';
  const tierMount = document.querySelector('[data-tier-note]');
  if (tierMount && customer.tier_name) {
    tierMount.innerHTML = `<div class="notice notice-success">Buyer rank: <strong>${customer.tier_name}</strong>${Number(customer.tier_discount_percent || 0) ? ` · auto discount ${customer.tier_discount_percent}%` : ''}</div>`;
    checkoutContext.tierDiscount = Math.round((checkoutContext.subtotal * Number(customer.tier_discount_percent || 0) / 100) * 100) / 100;
    await updateTotals();
  }
}

function handlePaymentReturn() {
  const paid = qs('paid');
  const order = qs('order');
  if (paid === '1' && order) {
    clearCart();
    setNotice(`<div class="notice notice-success">Payment confirmed. Your order number is <strong>${order}</strong>.</div>`);
  } else if (paid === '0') {
    const failedOrder = order ? ` for <strong>${order}</strong>` : '';
    setNotice(`<div class="notice notice-danger">Payment was not completed${failedOrder}. You can try again.</div>`);
  }
}

async function updateTotals() {
  const total = Math.max(0, checkoutContext.subtotal - checkoutContext.promoDiscount - checkoutContext.tierDiscount);
  const totalEl = document.querySelector('[data-checkout-total]');
  const discountEl = document.querySelector('[data-checkout-discounts]');
  const localEl = document.querySelector('[data-checkout-total-local]');
  if (totalEl) totalEl.textContent = formatNGN(total);
  if (discountEl) {
    discountEl.innerHTML = `${checkoutContext.promoDiscount ? `<div class="muted">Promo: -${formatNGN(checkoutContext.promoDiscount)}</div>` : ''}${checkoutContext.tierDiscount ? `<div class="muted">Tier: -${formatNGN(checkoutContext.tierDiscount)}</div>` : ''}`;
  }
  if (localEl) {
    const local = await localizePriceFromUSD(total / Number((await getStorefrontMeta()).usdRate || 1550) || 0);
    const note = document.querySelector('[data-checkout-ngn-note]');
    if (local.currency === 'NGN') {
      localEl.textContent = '';
      note?.classList.remove('hide');
    } else {
      localEl.textContent = `${local.formatted} preview`;
      note?.classList.remove('hide');
    }
  }
}

async function applyPromo() {
  const input = document.querySelector('[data-promo-code]');
  if (!input) return;
  const code = input.value.trim();
  if (!code) {
    checkoutContext.promoDiscount = 0;
    checkoutContext.promoCode = '';
    await updateTotals();
    return;
  }
  const result = await apiPost('/api/promotions/validate', { code, subtotal: checkoutContext.subtotal });
  const note = document.querySelector('[data-promo-note]');
  if (!result.ok) {
    checkoutContext.promoDiscount = 0;
    checkoutContext.promoCode = '';
    if (note) note.innerHTML = `<div class="notice notice-danger">${result.message || 'Promo code invalid.'}</div>`;
    await updateTotals();
    return;
  }
  checkoutContext.promoCode = result.promo.code;
  checkoutContext.promoDiscount = Number(result.promo.discount || 0);
  if (note) note.innerHTML = `<div class="notice notice-success">Promo applied: <strong>${result.promo.code}</strong></div>`;
  await updateTotals();
}

async function submitOrder(event) {
  event.preventDefault();
  const cart = getCart();
  if (!cart.length) {
    alert('Cart is empty.');
    return;
  }
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const meta = await getStorefrontMeta();
  const payload = {
    customer_name: form.customer_name.value,
    email: form.email.value,
    phone: form.phone.value,
    country: form.country.value,
    city: form.city.value,
    address: form.address.value,
    notes: form.notes.value,
    currency: 'NGN',
    country_code: meta.country,
    currency_rate: meta.usdRate,
    promo_code: checkoutContext.promoCode,
    items: cart
  };
  button.disabled = true;
  button.textContent = 'Redirecting to secure checkout...';
  const result = await apiPost('/api/paystack/initialize', payload);
  if (result.ok && result.authorizationUrl) {
    window.location.href = result.authorizationUrl;
    return;
  }
  setNotice(`<div class="notice notice-danger">${result.message || 'Could not initialize payment.'}</div>`);
  button.disabled = false;
  button.textContent = 'Pay securely';
}

document.addEventListener('DOMContentLoaded', async () => {
  handlePaymentReturn();
  await renderOrderPreview();
  await prefillCustomer();
  const promoButton = document.querySelector('[data-apply-promo]');
  if (promoButton) promoButton.addEventListener('click', applyPromo);
  document.querySelector('[data-checkout-form]')?.addEventListener('submit', submitOrder);
});
