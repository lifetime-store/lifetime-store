import { clearCart, formatNGN, getCart, removeCartItem, saveCartAndSync } from './api.js';

function renderCart() {
  const mount = document.querySelector('[data-cart-items]');
  const totals = document.querySelector('[data-cart-total]');
  if (!mount) return;

  const cart = getCart();
  if (cart.length === 0) {
    mount.innerHTML = `<div class="empty-state">Your cart is empty.</div>`;
    if (totals) totals.textContent = formatNGN(0);
    return;
  }

  mount.innerHTML = cart.map((item, index) => `
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
      <div class="price-line"><span class="price-main">${formatNGN(item.unit_price * item.quantity)}</span></div>
    </article>
  `).join('');

  const subtotal = cart.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
  if (totals) totals.textContent = formatNGN(subtotal);

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
  if (item.quantity < 1) {
    await removeCartItem(item.key);
  } else {
    await saveCartAndSync(cart);
  }
  renderCart();
}

document.addEventListener('DOMContentLoaded', () => {
  renderCart();
  document.querySelector('[data-clear-cart]')?.addEventListener('click', async () => {
    await clearCart();
    renderCart();
  });
});
