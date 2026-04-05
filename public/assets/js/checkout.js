import { apiPost, clearCart, formatNGN, getCart, qs } from "./api.js";

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

function setNotice(html) {
  const notice = document.querySelector("[data-checkout-notice]");
  if (notice) {
    notice.innerHTML = html;
  }
}

function handlePaymentReturn() {
  const paid = qs("paid");
  const order = qs("order");

  if (paid === "1" && order) {
    clearCart();
    setNotice(`<div class="notice notice-success">Payment confirmed. Your order number is <strong>${order}</strong>.</div>`);
  } else if (paid === "0") {
    const failedOrder = order ? ` for <strong>${order}</strong>` : "";
    setNotice(`<div class="notice notice-danger">Payment was not completed${failedOrder}. You can try again.</div>`);
  }
}

async function submitOrder(event) {
  event.preventDefault();

  const cart = getCart();
  if (cart.length === 0) {
    alert("Cart is empty.");
    return;
  }

  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');

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

  button.disabled = true;
  button.textContent = "Redirecting to secure checkout...";

  const result = await apiPost("/api/paystack/initialize", payload);

  if (result.ok && result.authorizationUrl) {
    window.location.href = result.authorizationUrl;
    return;
  }

  setNotice(`<div class="notice notice-danger">${result.message || "Could not initialize payment."}</div>`);
  button.disabled = false;
  button.textContent = "Pay securely";
}

document.addEventListener("DOMContentLoaded", () => {
  handlePaymentReturn();
  renderOrderPreview();
  document.querySelector("[data-checkout-form]")?.addEventListener("submit", submitOrder);
});
