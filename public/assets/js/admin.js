
import { apiGet, apiPost, getAdminToken, setAdminToken } from "./api.js";

function renderSummary(summary) {
  document.querySelector("[data-summary-products]").textContent = summary.products ?? 0;
  document.querySelector("[data-summary-batches]").textContent = summary.batches ?? 0;
  document.querySelector("[data-summary-codes]").textContent = summary.codes ?? 0;
  document.querySelector("[data-summary-issues]").textContent = summary.openIssues ?? 0;
  document.querySelector("[data-summary-orders]").textContent = summary.orders ?? 0;
}

async function refreshDashboard() {
  const summary = await apiGet("/api/admin/dashboard", true);
  if (!summary.ok) {
    showAuthNotice(summary.message || "Admin access failed.");
    return;
  }

  document.querySelector("[data-admin-shell]").classList.remove("hide");
  document.querySelector("[data-login-panel]").classList.add("hide");
  renderSummary(summary.summary || {});
  await Promise.all([loadProducts(), loadBatches(), loadCodes(), loadIssues(), loadOrders()]);
}

function showAuthNotice(message) {
  const notice = document.querySelector("[data-login-notice]");
  notice.innerHTML = `<div class="notice notice-danger">${message}</div>`;
}

async function loadProducts() {
  const res = await apiGet("/api/admin/products", true);
  const mount = document.querySelector("[data-admin-products]");
  if (!res.ok) {
    mount.innerHTML = `<div class="empty-state">${res.message}</div>`;
    return;
  }
  mount.innerHTML = (res.products || []).map((product) => `
    <article class="simple-row">
      <strong>${product.name}</strong>
      <span class="muted">${product.slug} · ${product.short_code}</span>
      <span class="muted">₦${Number(product.price_ngn).toLocaleString()} · $${Number(product.price_usd).toFixed(2)}</span>
    </article>
  `).join("");
}

async function loadBatches() {
  const res = await apiGet("/api/admin/batches", true);
  const mount = document.querySelector("[data-admin-batches]");
  if (!res.ok) {
    mount.innerHTML = `<div class="empty-state">${res.message}</div>`;
    return;
  }
  mount.innerHTML = (res.batches || []).map((batch) => `
    <article class="simple-row">
      <strong>${batch.batch_code}</strong>
      <span class="muted">${batch.product_name}${batch.color ? ` · ${batch.color}` : ""}${batch.size ? ` / ${batch.size}` : ""}</span>
      <span class="muted">${batch.quantity} pcs · ${batch.factory_name || "Factory not set"} · ${batch.status}</span>
    </article>
  `).join("");
}

async function loadCodes() {
  const res = await apiGet("/api/admin/codes", true);
  const mount = document.querySelector("[data-admin-codes]");
  if (!res.ok) {
    mount.innerHTML = `<div class="empty-state">${res.message}</div>`;
    return;
  }
  mount.innerHTML = (res.codes || []).slice(0, 20).map((code) => `
    <article class="code-row">
      <strong>${code.serial_code}</strong>
      <span class="muted">${code.product_name} · ${code.color || "Standard"} / ${code.size || "OS"}</span>
      <span class="muted">${code.status} · scans: ${code.scan_count}</span>
    </article>
  `).join("");
}

async function loadIssues() {
  const res = await apiGet("/api/admin/issues", true);
  const mount = document.querySelector("[data-admin-issues]");
  if (!res.ok) {
    mount.innerHTML = `<div class="empty-state">${res.message}</div>`;
    return;
  }
  mount.innerHTML = (res.issues || []).slice(0, 20).map((issue) => `
    <article class="issue-row">
      <strong>${issue.issue_type}</strong>
      <span class="muted">${issue.email}</span>
      <span class="muted">${issue.serial_code || "No serial linked"}</span>
      <span>${issue.message}</span>
    </article>
  `).join("");
}

async function loadOrders() {
  const res = await apiGet("/api/admin/orders", true);
  const mount = document.querySelector("[data-admin-orders]");
  if (!res.ok) {
    mount.innerHTML = `<div class="empty-state">${res.message}</div>`;
    return;
  }
  mount.innerHTML = (res.orders || []).slice(0, 20).map((order) => `
    <article class="order-card">
      <strong>${order.order_number}</strong>
      <span class="muted">${order.customer_name} · ${order.email}</span>
      <span class="muted">${order.status} · ${order.currency} ${Number(order.total).toLocaleString()}</span>
    </article>
  `).join("");
}

function setupForms() {
  document.querySelector("[data-login-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const token = event.currentTarget.token.value.trim();
    if (!token) return;
    setAdminToken(token);
    await refreshDashboard();
  });

  document.querySelector("[data-product-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    payload.active = 1;
    payload.featured = 1;
    const res = await apiPost("/api/admin/products", payload, true);
    alert(res.message || "Done.");
    if (res.ok) {
      form.reset();
      loadProducts();
      refreshDashboard();
    }
  });

  document.querySelector("[data-batch-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    const res = await apiPost("/api/admin/batches", payload, true);
    alert(res.message || "Done.");
    if (res.ok) {
      form.reset();
      loadBatches();
      refreshDashboard();
    }
  });

  document.querySelector("[data-generate-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    payload.action = "generate";
    const res = await apiPost("/api/admin/codes", payload, true);
    alert(res.message || "Done.");
    if (res.ok) {
      form.reset();
      loadCodes();
      refreshDashboard();
    }
  });

  document.querySelector("[data-activate-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const codes = form.codes.value
      .split("\n")
      .map((value) => value.trim())
      .filter(Boolean);

    const res = await apiPost("/api/admin/codes", { action: "activate", codes }, true);
    alert(res.message || "Done.");
    if (res.ok) {
      form.reset();
      loadCodes();
      refreshDashboard();
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  setupForms();
  if (getAdminToken()) {
    await refreshDashboard();
  }
});
