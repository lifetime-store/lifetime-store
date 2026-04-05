
import { clearCart, formatNGN, getCart, saveCart } from "./api.js";

function renderCart() {
  const mount = document.querySelector("[data-cart-items]");
  const totals = document.querySelector("[data-cart-total]");
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
        <button class="btn btn-danger" data-cart-remove="${index}">Remove</button>
      </div>
      <div class="price-line">
        <span class="price-main">${formatNGN(item.unit_price * item.quantity)}</span>
      </div>
    </article>
  `).join("");

  const subtotal = cart.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
  if (totals) totals.textContent = formatNGN(subtotal);

  mount.querySelectorAll("[data-cart-minus]").forEach((button) => {
    button.addEventListener("click", () => updateItem(Number(button.dataset.cartMinus), -1));
  });
  mount.querySelectorAll("[data-cart-plus]").forEach((button) => {
    button.addEventListener("click", () => updateItem(Number(button.dataset.cartPlus), 1));
  });
  mount.querySelectorAll("[data-cart-remove]").forEach((button) => {
    button.addEventListener("click", () => removeItem(Number(button.dataset.cartRemove)));
  });
}

function updateItem(index, delta) {
  const cart = getCart();
  cart[index].quantity += delta;
  if (cart[index].quantity < 1) cart.splice(index, 1);
  saveCart(cart);
  renderCart();
}

function removeItem(index) {
  const cart = getCart();
  cart.splice(index, 1);
  saveCart(cart);
  renderCart();
}

document.addEventListener("DOMContentLoaded", () => {
  renderCart();
  document.querySelector("[data-clear-cart]")?.addEventListener("click", () => {
    clearCart();
    renderCart();
  });
});
