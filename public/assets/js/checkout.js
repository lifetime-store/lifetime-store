
import { apiPost, clearCart, formatNGN, getCart } from "./api.js";

function renderOrderPreview() {
  const cart = getCart();
  const mount = document.querySelector("[data-checkout-items]");
  const totalEl = document.querySelector("[data-checkout-total]");
  if (!mount) return false;

  if (cart.length === 0) {
    mount.innerHTML = `<div class="notice notice-warning">Your cart is empty. Add products first.</div>`;
    if (totalEl) totalEl.textContent = formatNGN(0);
    return false;
  }

  const subtotal = cart.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
  mount.innerHTML = cart.map((item) => `
    <article class="cart-item">
      <strong>${item.product_name}</strong>
      <span class="muted">${item.color} / ${item.size}</span>
      <span class="muted">Qty: ${item.quantity}</span>
      <span>${formatNGN(item.unit_price * item.quantity)}</span>
    </article>
  `).join("");

  if (totalEl) totalEl.textContent = formatNGN(subtotal);
  return true;
}

async function submitOrder(event) {
  event.preventDefault();

  const cart = getCart();
  if (cart.length === 0) {
    alert("Cart is empty.");
    return;
  }

  const form = event.currentTarget;
  const payload = {
    customer_name: form.customer_name.value,
    email: form.email.value,
    phone: form.phone.value,
    country: form.country.value,
    city: form.city.value,
    address: form.address.value,
    notes: form.notes.value,
    currency: "NGN",
    items: cart
  };

  const result = await apiPost("/api/orders", payload);
  const notice = document.querySelector("[data-checkout-notice]");

  if (result.ok) {
    clearCart();
    notice.innerHTML = `<div class="notice notice-success">Order request received. Your order number is <strong>${result.orderNumber}</strong>.</div>`;
    form.reset();
    renderOrderPreview();
  } else {
    notice.innerHTML = `<div class="notice notice-danger">${result.message || "Order could not be submitted."}</div>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  renderOrderPreview();
  document.querySelector("[data-checkout-form]")?.addEventListener("submit", submitOrder);
});
