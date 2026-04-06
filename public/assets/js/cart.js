import { clearCart, formatNGN, getCart, getStorefrontMeta, localizePriceFromUSD, removeCartItem, saveCartAndSync } from './api.js';

async function renderCart() {
  const mount = document.querySelector('[data-cart-items]');
  const totals = document.querySelector('[data-cart-total]');
  const localTotals = document.querySelector('[data-cart-total-local]');
  if (!mount) return;

  const cart = getCart();
  if (!cart.length) {
    mount.innerHTML = `<div class="empty-state">Your cart is empty.</div>`;
    if (totals) totals.textContent = formatNGN(0);
    if (localTotals) localTotals.textContent = '';
    return;
  }

  const cards = await Promise.all(cart.map(async (item, index) => {
    const meta = await getStorefrontMeta();
    const local = await localizePriceFromUSD(Number(item.unit_price || 0) / Number(meta.usdRate || 1550) || 0);
    return `
      <article class="cart-item">
        <strong>${item.product_name}</strong>
        <span class="muted">${item.color} / ${item.size}</span>
        <span class="muted">${item.sku}</span>
        <div class="inline-actions">
          <button class="btn btn-soft" data-cart-minus="${index}">-</button>
          <span class="pill">${item.quantity}</span>
          <button class="btn btn-soft" data-cart-plus="${index}">+</button>
          <button class="btn btn-danger" data-cart-remove="${item.key}">Remove</button>
        </div>
        <div class="price-line"><span class="price-main">${formatNGN(item.unit_price * item.quantity)}</span>${local.currency === 'NGN' ? '' : `<span class=\"price-alt\">${local.formatted}</span>`}</div>
      </article>
    `;
  }));

  mount.innerHTML = cards.join('');
  const subtotal = cart.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
  if (totals) totals.textContent = formatNGN(subtotal);
  if (localTotals) {
    const meta = await getStorefrontMeta();
    const local = await localizePriceFromUSD(subtotal / Number(meta.usdRate || 1550) || 0);
    localTotals.textContent = meta.currency === 'NGN' ? '' : local.formatted;
  }

  mount.querySelectorAll('[data-cart-minus]').forEach((button) => button.addEventListener('click', () => updateItem(Number(button.dataset.cartMinus), -1)));
  mount.querySelectorAll('[data-cart-plus]').forEach((button) => button.addEventListener('click', () => updateItem(Number(button.dataset.cartPlus), 1)));
  mount.querySelectorAll('[data-cart-remove]').forEach((button) => button.addEventListener('click', async () => {
    await removeCartItem(button.dataset.cartRemove);
    renderCart();
  }));
}

async function updateItem(index, delta) {
  const cart = getCart();
  const item = cart[index];
  if (!item) return;
  item.quantity += delta;
  if (item.quantity < 1) await removeCartItem(item.key);
  else await saveCartAndSync(cart);
  renderCart();
}

document.addEventListener('DOMContentLoaded', () => {
  renderCart();
  document.querySelector('[data-clear-cart]')?.addEventListener('click', async () => {
    await clearCart();
    renderCart();
  });
});
