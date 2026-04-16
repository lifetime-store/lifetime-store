import {
  apiGet,
  apiPost,
  clearAdminToken,
  escapeHtml,
  formatNGN,
  formatUSD,
  getAdminToken,
  setAdminToken
} from "./api.js";

const state = {
  products: [],
  variants: [],
  batches: [],
  codes: [],
  orders: [],
  promotions: [],
  promoCodes: [],
  customers: [],
  staff: [],
  settings: {},
  selectedProductId: null,
  selectedImages: []
};

function notice(selector, message, variant = "success") {
  const mount = document.querySelector(selector);
  if (!mount) return;
  mount.innerHTML = message ? `<div class="notice notice-${variant}">${message}</div>` : "";
}

function renderSummary(summary) {
  document.querySelector("[data-summary-products]").textContent = summary.products ?? 0;
  document.querySelector("[data-summary-batches]").textContent = summary.batches ?? 0;
  document.querySelector("[data-summary-codes]").textContent = summary.codes ?? 0;
  document.querySelector("[data-summary-pending]").textContent = summary.pendingActivation ?? 0;
  document.querySelector("[data-summary-active-batches]").textContent = summary.activeBatches ?? 0;
  document.querySelector("[data-summary-orders]").textContent = summary.orders ?? 0;
  document.querySelector("[data-summary-buyers]") && (document.querySelector("[data-summary-buyers]").textContent = summary.buyers ?? 0);
  document.querySelector("[data-summary-promotions]") && (document.querySelector("[data-summary-promotions]").textContent = summary.promotions ?? 0);
}

function showShell(show) {
  document.querySelector("[data-login-panel]")?.classList.toggle("hide", show);
  document.querySelector("[data-admin-shell]")?.classList.toggle("hide", !show);
}

function showAuthNotice(message) {
  notice("[data-login-notice]", escapeHtml(message), "danger");
}

function populatePromotionSelects() {
  const options = [`<option value="">No linked promotion</option>`].concat(
    state.promotions.map((promotion) => `<option value="${promotion.id}">${escapeHtml(promotion.title)} (${escapeHtml(promotion.slug)})</option>`)
  );
  document.querySelectorAll('[data-promotion-select]').forEach((select) => {
    const current = select.value;
    select.innerHTML = options.join('');
    if (current) select.value = current;
  });
}

function populateProductSelects() {
  const options = [`<option value="">Select product</option>`].concat(
    state.products.map((product) => `<option value="${product.id}">${escapeHtml(product.name)} (#${product.id})</option>`)
  );
  document.querySelectorAll("[data-product-select]").forEach((select) => {
    const current = select.value;
    select.innerHTML = options.join("");
    if (current) select.value = current;
  });
}

function populateVariantSelects(productId = null) {
  const filtered = productId
    ? state.variants.filter((variant) => Number(variant.product_id) === Number(productId))
    : state.variants;
  const options = [`<option value="">Select variant</option>`].concat(
    filtered.map((variant) => `<option value="${variant.id}">${escapeHtml(variant.sku)} · ${escapeHtml(variant.color)} / ${escapeHtml(variant.size)}</option>`)
  );
  document.querySelectorAll("[data-variant-select]").forEach((select) => {
    const current = select.value;
    select.innerHTML = options.join("");
    if (current) select.value = current;
  });
}

function productCard(product) {
  const image = product.primary_image_url
    ? `<img src="${product.primary_image_url}" alt="${escapeHtml(product.name)}">`
    : `<div class="image-placeholder">${escapeHtml(product.short_code)}</div>`;

  return `
    <article class="admin-card">
      <div class="admin-card-media">${image}</div>
      <div class="admin-card-body">
        <div class="admin-card-head">
          <div>
            <strong>${escapeHtml(product.name)}</strong>
            <div class="muted">#${product.id} · ${escapeHtml(product.slug)} · ${escapeHtml(product.short_code)}</div>
          </div>
          <span class="pill">${product.active ? "Live" : "Hidden"}</span>
        </div>
        <div class="muted">${formatNGN(product.price_ngn)} · ${formatUSD(product.price_usd)}${product.compare_at_ngn ? ` · event compare ${formatNGN(product.compare_at_ngn)}` : ''} · ${product.image_count || 0} image(s) · ${product.variant_count || 0} variant(s)</div>
        <div class="admin-actions compact">
          <button class="btn btn-soft" type="button" data-edit-product="${product.id}">Edit</button>
          <button class="btn btn-soft" type="button" data-manage-images="${product.id}">Images</button>
          <button class="btn btn-soft" type="button" data-toggle-featured="${product.id}">${product.featured ? "Unfeature" : "Feature"}</button>
          <button class="btn btn-soft" type="button" data-toggle-product="${product.id}">${product.active ? "Hide" : "Show"}</button>
          <button class="btn btn-danger" type="button" data-delete-product="${product.id}">Delete</button>
        </div>
      </div>
    </article>
  `;
}

function variantCard(variant) {
  return `
    <article class="simple-row simple-row-spaced">
      <div>
        <strong>${escapeHtml(variant.sku)}</strong>
        <div class="muted">${escapeHtml(variant.product_name)} · ${escapeHtml(variant.color)} / ${escapeHtml(variant.size)}</div>
        <div class="muted">${formatNGN(variant.price_ngn || 0)}${variant.compare_at_ngn ? ` · compare ${formatNGN(variant.compare_at_ngn)}` : ''}</div>
      </div>
      <div class="admin-actions compact wrap">
        <span class="pill">Stock ${Number(variant.stock || 0)}</span>
        <button class="btn btn-soft" type="button" data-stock-adjust="${variant.id}" data-delta="-1">-1</button>
        <button class="btn btn-soft" type="button" data-stock-adjust="${variant.id}" data-delta="5">+5</button>
        <button class="btn btn-soft" type="button" data-stock-adjust="${variant.id}" data-delta="10">+10</button>
        <button class="btn btn-soft" type="button" data-set-stock="${variant.id}">Set stock</button>
        <button class="btn btn-soft" type="button" data-edit-variant="${variant.id}">Edit</button>
        <button class="btn btn-danger" type="button" data-delete-variant="${variant.id}">Delete</button>
      </div>
    </article>
  `;
}


function promotionCard(promotion) {
  return `
    <article class="simple-row simple-row-spaced"> 
      <div>
        <strong>${escapeHtml(promotion.title)}</strong>
        <div class="muted">${escapeHtml(promotion.slug)} · ${escapeHtml(promotion.discount_type)} ${promotion.discount_value}${promotion.discount_type === 'percent' ? '%' : ''}</div>
        <div class="muted">${escapeHtml(promotion.banner_text || '')}</div>
      </div>
      <div class="admin-actions compact wrap">
        <span class="pill">${promotion.active ? 'Active' : 'Inactive'}</span>
        <button class="btn btn-soft" type="button" data-edit-promotion="${promotion.id}">Edit</button>
        <button class="btn btn-danger" type="button" data-delete-promotion="${promotion.id}">Delete</button>
      </div>
    </article>
  `;
}

function promoCodeCard(code) {
  return `
    <article class="simple-row simple-row-spaced">
      <div>
        <strong>${escapeHtml(code.code)}</strong>
        <div class="muted">${escapeHtml(code.discount_type)} ${code.discount_value}${code.discount_type === 'percent' ? '%' : ''} · used ${Number(code.used_count || 0)}${code.usage_limit ? ` / ${code.usage_limit}` : ''}</div>
      </div>
      <div class="admin-actions compact wrap">
        <span class="pill">${code.active ? 'Active' : 'Off'}</span>
        <button class="btn btn-soft" type="button" data-edit-code="${code.id}">Edit</button>
        <button class="btn btn-danger" type="button" data-delete-code="${code.id}">Delete</button>
      </div>
    </article>
  `;
}

function customerCard(customer) {
  const currentLevel = Number(customer.rank_level || 1);
  const stars = Array.from({ length: 5 }, (_, index) => `<span class="star-dot ${index < currentLevel ? 'active' : ''}">★</span>`).join('');
  return `
    <article class="simple-row simple-row-spaced customer-tier-card">
      <div>
        <strong>${escapeHtml(customer.full_name || customer.email)}</strong>
        <div class="muted">${escapeHtml(customer.email)} · ${customer.paid_orders} successful paid order(s)</div>
        <div class="muted">${formatNGN(customer.lifetime_spend)} spend · ${customer.loyalty_points} points</div>
        <div class="progress-track compact"><span style="width:${Number(customer.rank_progress_percent || 0)}%"></span></div>
        <div class="muted">${customer.next_tier_name ? `${Number(customer.next_tier_orders_needed || 0)} order(s) to ${escapeHtml(customer.next_tier_name)}` : 'Top rank unlocked'}</div>
      </div>
      <div class="admin-actions compact wrap">
        <span class="pill">${escapeHtml(customer.tier_name)}</span>
        <span class="pill">-${Number(customer.tier_discount_percent || 0)}%</span>
        <div class="star-row mini">${stars}</div>
      </div>
    </article>
  `;
}

function staffCard(staff) {
  const roleMap = {
    operations: 'Products, orders, stock',
    inventory: 'Batches, labels, stock in/out',
    support: 'Customer lookup and verification',
    marketing: 'Promotions and campaign review'
  };
  return `
    <article class="simple-row simple-row-spaced">
      <div>
        <strong>${escapeHtml(staff.full_name)}</strong>
        <div class="muted">${escapeHtml(staff.email)} · ${escapeHtml(staff.role)}</div>
        <div class="muted">${escapeHtml(staff.access_scope || roleMap[staff.role] || '')}</div>
      </div>
      <div class="admin-actions compact wrap">
        <span class="pill">${escapeHtml(staff.status || 'active')}</span>
        <button class="btn btn-soft" type="button" data-edit-staff="${staff.id}">Edit</button>
        <button class="btn btn-danger" type="button" data-delete-staff="${staff.id}">Delete</button>
      </div>
    </article>
  `;
}

function batchStageActions(batch) {
  const id = Number(batch.id);
  return `
    <div class="admin-actions compact wrap">
      <button class="btn btn-soft" type="button" data-generate-batch="${id}">Generate labels</button>
      <button class="btn btn-soft" type="button" data-open-labels-batch="${id}">Print labels</button>
      <button class="btn btn-soft" type="button" data-set-batch-stage="${id}" data-stage="printed">Mark printed</button>
      <button class="btn btn-soft" type="button" data-set-batch-stage="${id}" data-stage="attached">Mark attached</button>
      <button class="btn btn-soft" type="button" data-set-batch-stage="${id}" data-stage="received">Mark received</button>
      <button class="btn btn-primary" type="button" data-activate-batch="${id}">Activate batch</button>
    </div>
  `;
}

function batchCard(batch) {
  return `
    <article class="workflow-card">
      <div class="workflow-head">
        <div>
          <strong>${escapeHtml(batch.batch_code)}</strong>
          <div class="muted">${escapeHtml(batch.product_name)}${batch.color ? ` · ${escapeHtml(batch.color)}` : ""}${batch.size ? ` / ${escapeHtml(batch.size)}` : ""}</div>
        </div>
        <span class="pill">${escapeHtml(batch.status || "batch_created")}</span>
      </div>
      <div class="workflow-meta">
        <span>${Number(batch.quantity || 0)} pcs</span>
        <span>${Number(batch.code_count || 0)} labels</span>
        <span>${Number(batch.pending_code_count || 0)} pending</span>
        <span>${Number(batch.active_code_count || 0)} active</span>
      </div>
      <div class="muted">Factory: ${escapeHtml(batch.factory_name || "Lifetime production partner")}${batch.manufactured_at ? ` · Production date: ${escapeHtml(batch.manufactured_at)}` : ""}</div>
      ${batch.notes ? `<div class="muted">${escapeHtml(batch.notes)}</div>` : ""}
      ${batchStageActions(batch)}
    </article>
  `;
}

function codeCard(code) {
  const verifyUrl = `/verify.html?code=${encodeURIComponent(code.serial_code)}`;
  return `
    <article class="simple-row code-card">
      <div>
        <strong>${escapeHtml(code.serial_code)}</strong>
        <div class="muted">${escapeHtml(code.product_name)} · ${escapeHtml(code.color || "Standard")} / ${escapeHtml(code.size || "OS")}</div>
        <div class="muted">Batch ${escapeHtml(code.batch_code)} · status ${escapeHtml(code.status)}</div>
      </div>
      <div class="admin-actions compact wrap">
        <a class="btn btn-soft" href="${verifyUrl}" target="_blank" rel="noreferrer">Verify page</a>
      </div>
    </article>
  `;
}

function orderCard(order) {
  return `
    <article class="order-row">
      <div>
        <strong>${escapeHtml(order.order_number)}</strong>
        <div class="muted">${escapeHtml(order.customer_name)} · ${escapeHtml(order.email)}</div>
        <div class="muted">${formatNGN(order.total)} · ${order.item_count || 0} item(s)</div>
      </div>
      <div class="order-row-actions">
        <select data-order-status-select="${order.id}">
          ${["pending","awaiting_payment","paid","processing","shipped","delivered","cancelled","payment_failed"].map((status) => `<option value="${status}" ${order.status === status ? "selected" : ""}>${status}</option>`).join("")}
        </select>
        <button class="btn btn-soft" type="button" data-save-order="${order.id}">Save</button>
      </div>
    </article>
  `;
}

function imageCard(image) {
  return `
    <article class="media-card">
      <img src="${image.data_url}" alt="${escapeHtml(image.alt_text || "Product image")}">
      <div class="media-card-body">
        <div class="muted">${image.is_primary ? "Primary image" : "Gallery image"}</div>
        <div class="admin-actions compact">
          <button class="btn btn-soft" type="button" data-set-primary="${image.id}">Make primary</button>
          <button class="btn btn-danger" type="button" data-delete-image="${image.id}">Delete</button>
        </div>
      </div>
    </article>
  `;
}

async function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to read the image file."));
    reader.readAsDataURL(file);
  });
}


async function loadPromotions() {
  const res = await apiGet('/api/admin/promotions', true);
  const promotionsMount = document.querySelector('[data-admin-promotions]');
  const codesMount = document.querySelector('[data-admin-promo-codes]');
  if (!res.ok) {
    if (promotionsMount) promotionsMount.innerHTML = `<div class="empty-state">${escapeHtml(res.message || 'Could not load promotions.')}</div>`;
    return;
  }
  state.promotions = res.promotions || [];
  state.promoCodes = res.promoCodes || [];
  populatePromotionSelects();
  if (promotionsMount) promotionsMount.innerHTML = state.promotions.length ? state.promotions.map(promotionCard).join('') : `<div class="empty-state">No promotions yet.</div>`;
  if (codesMount) codesMount.innerHTML = state.promoCodes.length ? state.promoCodes.map(promoCodeCard).join('') : `<div class="empty-state">No promo codes yet.</div>`;
  bindPromotionActions();
}

async function loadCustomers() {
  const res = await apiGet('/api/admin/customers', true);
  const mount = document.querySelector('[data-admin-customers]');
  if (!mount) return;
  if (!res.ok) {
    mount.innerHTML = `<div class="empty-state">${escapeHtml(res.message || 'Could not load buyers.')}</div>`;
    return;
  }
  state.customers = res.customers || [];
  mount.innerHTML = state.customers.length ? state.customers.map(customerCard).join('') : `<div class="empty-state">No buyer data yet.</div>`;
}

function bindPromotionActions() {
  document.querySelectorAll('[data-edit-promotion]').forEach((button) => {
    button.onclick = () => {
      const promotion = state.promotions.find((entry) => Number(entry.id) === Number(button.dataset.editPromotion));
      const form = document.querySelector('[data-promotion-form]');
      if (!promotion || !form) return;
      form.promotion_id.value = promotion.id;
      form.title.value = promotion.title || '';
      form.slug.value = promotion.slug || '';
      form.discount_type.value = promotion.discount_type || 'percent';
      form.discount_value.value = promotion.discount_value || 0;
      form.badge_text.value = promotion.badge_text || '';
      form.banner_text.value = promotion.banner_text || '';
      form.apply_scope.value = promotion.apply_scope || 'storewide';
      form.active.checked = Boolean(promotion.active);
      form.featured.checked = Boolean(promotion.featured);
    };
  });
  document.querySelectorAll('[data-delete-promotion]').forEach((button) => {
    button.onclick = async () => {
      if (!window.confirm('Delete this promotion?')) return;
      const result = await apiPost('/api/admin/promotions', { action: 'delete_promotion', id: Number(button.dataset.deletePromotion) }, true);
      notice('[data-promo-notice]', escapeHtml(result.message || 'Updated.'), result.ok ? 'success' : 'danger');
      if (result.ok) await Promise.all([loadPromotions(), refreshSummaryOnly()]);
    };
  });
  document.querySelectorAll('[data-edit-code]').forEach((button) => {
    button.onclick = () => {
      const code = state.promoCodes.find((entry) => Number(entry.id) === Number(button.dataset.editCode));
      const form = document.querySelector('[data-promo-code-form]');
      if (!code || !form) return;
      form.promo_code_id.value = code.id;
      form.promotion_id.value = code.promotion_id || '';
      form.code.value = code.code || '';
      form.discount_type.value = code.discount_type || 'percent';
      form.discount_value.value = code.discount_value || 0;
      form.min_subtotal.value = code.min_subtotal || 0;
      form.usage_limit.value = code.usage_limit || '';
      form.tier_gate.value = code.tier_gate || '';
      form.active.checked = Boolean(code.active);
    };
  });
  document.querySelectorAll('[data-delete-code]').forEach((button) => {
    button.onclick = async () => {
      if (!window.confirm('Delete this promo code?')) return;
      const result = await apiPost('/api/admin/promotions', { action: 'delete_code', id: Number(button.dataset.deleteCode) }, true);
      notice('[data-promo-notice]', escapeHtml(result.message || 'Updated.'), result.ok ? 'success' : 'danger');
      if (result.ok) await loadPromotions();
    };
  });
}


async function loadSettings() {
  const res = await apiGet('/api/admin/settings', true);
  if (!res.ok) {
    notice('[data-settings-notice]', escapeHtml(res.message || 'Could not load site settings.'), 'danger');
    return;
  }
  state.settings = res.settings || {};
  const form = document.querySelector('[data-settings-form]');
  if (!form) return;
  const fields = ['store_notice_badge','store_notice','verify_scanner_hint','hero_eyebrow','hero_title','hero_copy','hero_cta_label','hero_cta_href','shipping_policy_html','returns_policy_html','exchange_policy_html','size_guide_html','support_intro','orders_intro'];
  fields.forEach((key) => { if (form[key]) form[key].value = state.settings[key] || ''; });
}


async function refreshDashboard() {
  const summary = await apiGet("/api/admin/dashboard", true);
  if (!summary.ok) {
    showShell(false);
    showAuthNotice(summary.message || "Admin access failed.");
    return;
  }

  showShell(true);
  renderSummary(summary.summary || {});
  await Promise.all([loadProducts(), loadVariants(), loadBatches(), loadCodes(), loadOrders(), loadPromotions(), loadCustomers(), loadSettings(), loadAudit()]);
}

async function loadProducts() {
  const res = await apiGet("/api/admin/products", true);
  const mount = document.querySelector("[data-admin-products]");
  if (!res.ok) {
    mount.innerHTML = `<div class="empty-state">${escapeHtml(res.message || "Could not load products.")}</div>`;
    return;
  }
  state.products = res.products || [];
  populateProductSelects();
  mount.innerHTML = state.products.length ? state.products.map(productCard).join("") : `<div class="empty-state">No products yet.</div>`;
  bindProductActions();
  if (!state.selectedProductId && state.products[0]) state.selectedProductId = state.products[0].id;
  if (state.selectedProductId) {
    document.querySelector("[data-image-product-id]").value = String(state.selectedProductId);
    await loadImages(state.selectedProductId);
  } else {
    document.querySelector("[data-admin-images]").innerHTML = `<div class="empty-state">Select a product to manage images.</div>`;
  }
}

async function loadVariants(productId = null) {
  const url = productId ? `/api/admin/variants?product_id=${encodeURIComponent(productId)}` : "/api/admin/variants";
  const res = await apiGet(url, true);
  const mount = document.querySelector("[data-admin-variants]");
  if (!res.ok) {
    mount.innerHTML = `<div class="empty-state">${escapeHtml(res.message || "Could not load variants.")}</div>`;
    return;
  }
  state.variants = res.variants || [];
  populateVariantSelects(document.querySelector("[data-batch-product-id]")?.value || state.selectedProductId);
  mount.innerHTML = state.variants.length ? state.variants.map(variantCard).join("") : `<div class="empty-state">No variants yet.</div>`;
  bindVariantActions();
}

async function loadImages(productId) {
  const mount = document.querySelector("[data-admin-images]");
  const title = document.querySelector("[data-images-title]");
  if (!productId) {
    mount.innerHTML = `<div class="empty-state">Select a product to manage images.</div>`;
    title.textContent = "Product images";
    return;
  }
  const product = state.products.find((entry) => Number(entry.id) === Number(productId));
  title.textContent = product ? `Product images — ${product.name}` : "Product images";
  const res = await apiGet(`/api/admin/product-images?product_id=${encodeURIComponent(productId)}`, true);
  if (!res.ok) {
    mount.innerHTML = `<div class="empty-state">${escapeHtml(res.message || "Could not load images.")}</div>`;
    return;
  }
  state.selectedImages = res.images || [];
  mount.innerHTML = state.selectedImages.length ? state.selectedImages.map(imageCard).join("") : `<div class="empty-state">No images yet.</div>`;
  bindImageActions();
}

async function loadBatches() {
  const res = await apiGet("/api/admin/batches", true);
  const mount = document.querySelector("[data-admin-batches]");
  if (!res.ok) {
    mount.innerHTML = `<div class="empty-state">${escapeHtml(res.message || "Could not load batches.")}</div>`;
    return;
  }
  state.batches = res.batches || [];
  mount.innerHTML = state.batches.length ? state.batches.map(batchCard).join("") : `<div class="empty-state">No batches yet.</div>`;
  bindBatchActions();
}

async function loadCodes() {
  const res = await apiGet("/api/admin/codes", true);
  const mount = document.querySelector("[data-admin-codes]");
  if (!res.ok) {
    mount.innerHTML = `<div class="empty-state">${escapeHtml(res.message || "Could not load labels.")}</div>`;
    return;
  }
  state.codes = res.codes || [];
  mount.innerHTML = state.codes.length ? state.codes.slice(0, 40).map(codeCard).join("") : `<div class="empty-state">No authenticity labels generated yet.</div>`;
}

async function loadAudit() {
  const mount = document.querySelector('[data-admin-audit]');
  if (!mount) return;
  const res = await apiGet('/api/admin/audit', true);
  if (!res.ok) { mount.innerHTML = `<div class="empty-state">${escapeHtml(res.message || 'Could not load audit log.')}</div>`; return; }
  const logs = res.logs || [];
  mount.innerHTML = logs.length ? logs.map((log) => `<article class="simple-row"><strong>${escapeHtml(log.action)}</strong><div class="muted">${escapeHtml(log.actor || 'owner')} · ${escapeHtml(log.created_at || '')}</div><div class="muted">${escapeHtml(log.target_type || '')}${log.target_id ? ` #${log.target_id}` : ''}</div></article>`).join('') : `<div class="empty-state">No admin activity yet.</div>`;
}

async function loadOrders() {
  const res = await apiGet("/api/admin/orders", true);
  const mount = document.querySelector("[data-admin-orders]");
  if (!res.ok) {
    mount.innerHTML = `<div class="empty-state">${escapeHtml(res.message || "Could not load orders.")}</div>`;
    return;
  }
  state.orders = res.orders || [];
  mount.innerHTML = state.orders.length ? state.orders.slice(0, 20).map(orderCard).join("") : `<div class="empty-state">No orders yet.</div>`;
  bindOrderActions();
}

function fillProductForm(product) {
  const form = document.querySelector("[data-product-form]");
  if (!form || !product) return;
  form.product_id.value = product.id;
  form.slug.value = product.slug || "";
  form.short_code.value = product.short_code || "";
  form.name.value = product.name || "";
  form.category.value = product.category || "";
  form.price_ngn.value = product.price_ngn || "";
  form.price_usd.value = product.price_usd || "";
  if (form.compare_at_ngn) form.compare_at_ngn.value = product.compare_at_ngn || '';
  if (form.compare_at_usd) form.compare_at_usd.value = product.compare_at_usd || '';
  form.tagline.value = product.tagline || "";
  form.description.value = product.description || "";
  form.materials.value = product.materials || "";
  if (form.collection_label) form.collection_label.value = product.collection_label || '';
  if (form.mood_label) form.mood_label.value = product.mood_label || '';
  form.fit_notes.value = product.fit_notes || "";
  form.care.value = product.care || "";
  form.active.checked = Boolean(product.active);
  form.featured.checked = Boolean(product.featured);
}

function fillVariantForm(variant) {
  const form = document.querySelector("[data-variant-form]");
  if (!form || !variant) return;
  form.variant_id.value = variant.id;
  form.product_id.value = variant.product_id || "";
  form.sku.value = variant.sku || "";
  form.color.value = variant.color || "";
  form.color_code.value = variant.color_code || "";
  form.size.value = variant.size || "";
  form.size_code.value = variant.size_code || "";
  form.stock.value = variant.stock || 0;
  form.price_ngn.value = variant.price_ngn ?? "";
  form.price_usd.value = variant.price_usd ?? "";
  if (form.compare_at_ngn) form.compare_at_ngn.value = variant.compare_at_ngn ?? '';
  if (form.compare_at_usd) form.compare_at_usd.value = variant.compare_at_usd ?? '';
  form.active.checked = Boolean(variant.active);
  form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  form.sku.focus();
}

function bindProductActions() {
  document.querySelectorAll("[data-edit-product]").forEach((button) => {
    button.onclick = () => fillProductForm(state.products.find((entry) => Number(entry.id) === Number(button.dataset.editProduct)));
  });

  document.querySelectorAll("[data-manage-images]").forEach((button) => {
    button.onclick = async () => {
      state.selectedProductId = Number(button.dataset.manageImages);
      document.querySelector("[data-image-product-id]").value = String(state.selectedProductId);
      await loadImages(state.selectedProductId);
    };
  });

  document.querySelectorAll("[data-toggle-featured]").forEach((button) => {
    button.onclick = async () => {
      const result = await apiPost("/api/admin/products", { action: "toggle_featured", id: Number(button.dataset.toggleFeatured) }, true);
      notice("[data-global-notice]", escapeHtml(result.message || "Updated."), result.ok ? "success" : "danger");
      if (result.ok) await loadProducts();
    };
  });

  document.querySelectorAll("[data-toggle-product]").forEach((button) => {
    button.onclick = async () => {
      const result = await apiPost("/api/admin/products", { action: "toggle_active", id: Number(button.dataset.toggleProduct) }, true);
      notice("[data-global-notice]", escapeHtml(result.message || "Updated."), result.ok ? "success" : "danger");
      if (result.ok) await loadProducts();
    };
  });

  document.querySelectorAll("[data-delete-product]").forEach((button) => {
    button.onclick = async () => {
      if (!window.confirm("Delete this product? This also removes linked variants, images, and batches.")) return;
      const result = await apiPost("/api/admin/products", { action: "delete", id: Number(button.dataset.deleteProduct) }, true);
      notice("[data-global-notice]", escapeHtml(result.message || "Updated."), result.ok ? "success" : "danger");
      if (result.ok) await refreshDashboard();
    };
  });
}

function bindVariantActions() {
  document.querySelectorAll("[data-edit-variant]").forEach((button) => {
    button.onclick = () => fillVariantForm(state.variants.find((entry) => Number(entry.id) === Number(button.dataset.editVariant)));
  });

  document.querySelectorAll('[data-set-stock]').forEach((button) => {
    button.onclick = async () => {
      const id = Number(button.dataset.setStock);
      const current = state.variants.find((entry) => Number(entry.id) === id);
      const next = window.prompt('Enter the exact available stock for this variant.', String(current?.stock || 0));
      if (next === null) return;
      const result = await apiPost('/api/admin/variants', { action: 'set_stock', id, stock: Number(next || 0) }, true);
      notice('[data-variant-notice]', escapeHtml(result.message || 'Updated.'), result.ok ? 'success' : 'danger');
      if (result.ok) await Promise.all([loadVariants(), refreshSummaryOnly()]);
    };
  });

  document.querySelectorAll('[data-stock-adjust]').forEach((button) => {
    button.onclick = async () => {
      const id = Number(button.dataset.stockAdjust);
      const delta = Number(button.dataset.delta || 0);
      const result = await apiPost('/api/admin/variants', { action: 'adjust_stock', id, delta }, true);
      notice('[data-variant-notice]', escapeHtml(result.message || 'Updated.'), result.ok ? 'success' : 'danger');
      if (result.ok) await Promise.all([loadVariants(), refreshSummaryOnly()]);
    };
  });

  document.querySelectorAll("[data-delete-variant]").forEach((button) => {
    button.onclick = async () => {
      if (!window.confirm("Delete this variant?")) return;
      const result = await apiPost("/api/admin/variants", { action: "delete", id: Number(button.dataset.deleteVariant) }, true);
      notice("[data-variant-notice]", escapeHtml(result.message || "Updated."), result.ok ? "success" : "danger");
      if (result.ok) await refreshDashboard();
    };
  });
}

function bindBatchActions() {
  document.querySelectorAll("[data-generate-batch]").forEach((button) => {
    button.onclick = async () => {
      const batchId = Number(button.dataset.generateBatch);
      const batch = state.batches.find((entry) => Number(entry.id) === batchId);
      const input = window.prompt("How many labels should be generated for this batch?", String(batch?.quantity || 0));
      if (!input) return;
      const quantity = Number(input);
      const result = await apiPost("/api/admin/codes", { action: "generate", batch_id: batchId, quantity }, true);
      notice("[data-codes-notice]", escapeHtml(result.message || "Updated."), result.ok ? "success" : "danger");
      if (result.ok) await Promise.all([loadBatches(), loadCodes()]);
    };
  });

  document.querySelectorAll("[data-open-labels-batch]").forEach((button) => {
    button.onclick = () => {
      const batchId = Number(button.dataset.openLabelsBatch);
      window.open(`/print-labels.html?batch_id=${batchId}`, "_blank", "noopener");
    };
  });

  document.querySelectorAll("[data-set-batch-stage]").forEach((button) => {
    button.onclick = async () => {
      const batchId = Number(button.dataset.setBatchStage);
      const status = button.dataset.stage;
      const result = await apiPost("/api/admin/batches", { action: "set_status", batch_id: batchId, status }, true);
      notice("[data-global-notice]", escapeHtml(result.message || "Updated."), result.ok ? "success" : "danger");
      if (result.ok) await Promise.all([loadBatches(), loadCodes(), refreshSummaryOnly()]);
    };
  });

  document.querySelectorAll("[data-activate-batch]").forEach((button) => {
    button.onclick = async () => {
      const batchId = Number(button.dataset.activateBatch);
      if (!window.confirm("Activate this batch? Customers will now be able to verify the authenticity labels.")) return;
      const result = await apiPost("/api/admin/batches", { action: "activate", batch_id: batchId }, true);
      notice("[data-global-notice]", escapeHtml(result.message || "Updated."), result.ok ? "success" : "danger");
      if (result.ok) await Promise.all([loadBatches(), loadCodes(), refreshSummaryOnly()]);
    };
  });
}

function bindOrderActions() {
  document.querySelectorAll("[data-save-order]").forEach((button) => {
    button.onclick = async () => {
      const id = Number(button.dataset.saveOrder);
      const select = document.querySelector(`[data-order-status-select="${id}"]`);
      const status = select?.value || "";
      const result = await apiPost("/api/admin/orders", { id, status }, true);
      notice("[data-global-notice]", escapeHtml(result.message || "Updated."), result.ok ? "success" : "danger");
      if (result.ok) await loadOrders();
    };
  });
}

function bindImageActions() {
  document.querySelectorAll("[data-set-primary]").forEach((button) => {
    button.onclick = async () => {
      const imageId = Number(button.dataset.setPrimary);
      const result = await apiPost("/api/admin/product-images", {
        action: "set_primary",
        image_id: imageId,
        product_id: state.selectedProductId
      }, true);
      notice("[data-images-notice]", escapeHtml(result.message || "Updated."), result.ok ? "success" : "danger");
      if (result.ok) await loadImages(state.selectedProductId);
    };
  });

  document.querySelectorAll("[data-delete-image]").forEach((button) => {
    button.onclick = async () => {
      if (!window.confirm("Delete this product image?")) return;
      const result = await apiPost("/api/admin/product-images", {
        action: "delete",
        image_id: Number(button.dataset.deleteImage)
      }, true);
      notice("[data-images-notice]", escapeHtml(result.message || "Updated."), result.ok ? "success" : "danger");
      if (result.ok) await loadImages(state.selectedProductId);
    };
  });
}

async function refreshSummaryOnly() {
  const summary = await apiGet("/api/admin/dashboard", true);
  if (summary.ok) renderSummary(summary.summary || {});
}

async function onLoginSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const username = form.username.value.trim();
  const password = form.password.value;
  const token = form.token.value.trim();

  let result;
  if (username || password) {
    result = await apiPost("/api/admin/auth/login", { username, password });
    if (result.ok) clearAdminToken();
  } else if (token) {
    setAdminToken(token);
    result = await apiPost("/api/admin/auth/login", { token }, true);
  } else {
    showAuthNotice("Enter your admin username and password, or use your token.");
    return;
  }

  if (!result.ok) {
    if (token) clearAdminToken();
    showAuthNotice(result.message || "Sign in failed.");
    return;
  }

  notice("[data-login-notice]", escapeHtml(result.message || "Signed in."), "success");
  await refreshDashboard();
  form.reset();
}

function bindForms() {
  document.querySelector("[data-login-form]")?.addEventListener("submit", onLoginSubmit);

  document.querySelector("[data-admin-logout]")?.addEventListener("click", async () => {
    await apiPost("/api/admin/auth/logout", {}, true);
    clearAdminToken();
    showShell(false);
    showAuthNotice("Signed out.");
  });

  document.querySelector("[data-product-reset]")?.addEventListener("click", () => {
    document.querySelector("[data-product-form]")?.reset();
    document.querySelector("[data-product-form] [name='product_id']").value = "";
  });

  document.querySelector("[data-variant-reset]")?.addEventListener("click", () => {
    document.querySelector("[data-variant-form]")?.reset();
    document.querySelector("[data-variant-form] [name='variant_id']").value = "";
  });

  document.querySelector("[data-batch-product-id]")?.addEventListener("change", async (event) => {
    state.selectedProductId = Number(event.currentTarget.value || 0) || null;
    populateVariantSelects(state.selectedProductId);
    await loadImages(state.selectedProductId);
  });

  document.querySelectorAll("[data-product-select]").forEach((select) => {
    select.addEventListener("change", async (event) => {
      if (event.currentTarget.dataset.imageProductId !== undefined) {
        state.selectedProductId = Number(event.currentTarget.value || 0) || null;
        await loadImages(state.selectedProductId);
      }
    });
  });

  document.querySelector("[data-product-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = {
      id: form.product_id.value ? Number(form.product_id.value) : null,
      slug: form.slug.value.trim(),
      short_code: form.short_code.value.trim().toUpperCase(),
      name: form.name.value.trim(),
      category: form.category.value.trim(),
      price_ngn: Number(form.price_ngn.value),
      price_usd: Number(form.price_usd.value),
      compare_at_ngn: form.compare_at_ngn?.value ? Number(form.compare_at_ngn.value) : null,
      compare_at_usd: form.compare_at_usd?.value ? Number(form.compare_at_usd.value) : null,
      tagline: form.tagline.value.trim(),
      description: form.description.value.trim(),
      materials: form.materials.value.trim(),
      fit_notes: form.fit_notes.value.trim(),
      care: form.care.value.trim(),
      collection_label: form.collection_label?.value?.trim() || '',
      mood_label: form.mood_label?.value?.trim() || '',
      active: form.active.checked ? 1 : 0,
      featured: form.featured.checked ? 1 : 0
    };
    const result = await apiPost("/api/admin/products", payload, true);
    notice("[data-product-notice]", escapeHtml(result.message || "Saved."), result.ok ? "success" : "danger");
    if (result.ok) {
      form.reset();
      form.product_id.value = "";
      await refreshDashboard();
    }
  });

  document.querySelector("[data-variant-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = {
      id: form.variant_id.value ? Number(form.variant_id.value) : null,
      product_id: Number(form.product_id.value),
      sku: form.sku.value.trim().toUpperCase(),
      color: form.color.value.trim(),
      color_code: form.color_code.value.trim().toUpperCase(),
      size: form.size.value.trim().toUpperCase(),
      size_code: form.size_code.value.trim().toUpperCase(),
      stock: Number(form.stock.value || 0),
      price_ngn: form.price_ngn.value ? Number(form.price_ngn.value) : null,
      price_usd: form.price_usd.value ? Number(form.price_usd.value) : null,
      compare_at_ngn: form.compare_at_ngn?.value ? Number(form.compare_at_ngn.value) : null,
      compare_at_usd: form.compare_at_usd?.value ? Number(form.compare_at_usd.value) : null,
      active: form.active.checked ? 1 : 0
    };
    const result = await apiPost("/api/admin/variants", payload, true);
    notice("[data-variant-notice]", escapeHtml(result.message || "Saved."), result.ok ? "success" : "danger");
    if (result.ok) {
      form.reset();
      form.variant_id.value = "";
      await refreshDashboard();
    }
  });

  document.querySelector("[data-batch-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = {
      product_id: Number(form.product_id.value),
      variant_id: form.variant_id.value ? Number(form.variant_id.value) : null,
      factory_name: form.factory_name.value.trim(),
      quantity: Number(form.quantity.value),
      status: form.status.value,
      manufactured_at: form.manufactured_at.value,
      notes: form.notes.value.trim()
    };
    const result = await apiPost("/api/admin/batches", payload, true);
    notice("[data-batch-notice]", escapeHtml(result.message || "Saved."), result.ok ? "success" : "danger");
    if (result.ok) {
      form.reset();
      form.status.value = "batch_created";
      await refreshDashboard();
    }
  });

  document.querySelector("[data-generate-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = {
      action: "generate",
      batch_id: Number(form.batch_id.value),
      quantity: Number(form.quantity.value)
    };
    const result = await apiPost("/api/admin/codes", payload, true);
    notice("[data-codes-notice]", escapeHtml(result.message || "Saved."), result.ok ? "success" : "danger");
    if (result.ok) await Promise.all([loadBatches(), loadCodes(), refreshSummaryOnly()]);
  });

  document.querySelector("[data-open-labels]")?.addEventListener("click", () => {
    const batchId = Number(document.querySelector("[data-generate-form] [name='batch_id']")?.value || 0);
    if (!batchId) {
      notice("[data-codes-notice]", "Enter a batch ID first.", "danger");
      return;
    }
    window.open(`/print-labels.html?batch_id=${batchId}`, "_blank", "noopener");
  });


  document.querySelector('[data-promotion-reset]')?.addEventListener('click', () => {
    document.querySelector('[data-promotion-form]')?.reset();
    document.querySelector('[data-promotion-form] [name="promotion_id"]').value = '';
  });

  document.querySelector('[data-promo-code-reset]')?.addEventListener('click', () => {
    document.querySelector('[data-promo-code-form]')?.reset();
    document.querySelector('[data-promo-code-form] [name="promo_code_id"]').value = '';
  });

  document.querySelector('[data-promotion-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = {
      id: form.promotion_id.value ? Number(form.promotion_id.value) : null,
      title: form.title.value.trim(),
      slug: form.slug.value.trim(),
      discount_type: form.discount_type.value,
      discount_value: Number(form.discount_value.value || 0),
      badge_text: form.badge_text.value.trim(),
      banner_text: form.banner_text.value.trim(),
      apply_scope: form.apply_scope.value.trim(),
      active: form.active.checked ? 1 : 0,
      featured: form.featured.checked ? 1 : 0
    };
    const result = await apiPost('/api/admin/promotions', payload, true);
    notice('[data-promo-notice]', escapeHtml(result.message || 'Saved.'), result.ok ? 'success' : 'danger');
    if (result.ok) {
      form.reset();
      form.promotion_id.value = '';
      await Promise.all([loadPromotions(), refreshSummaryOnly()]);
    }
  });

  document.querySelector('[data-promo-code-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = {
      id: form.promo_code_id.value ? Number(form.promo_code_id.value) : null,
      promotion_id: form.promotion_id.value ? Number(form.promotion_id.value) : null,
      code: form.code.value.trim().toUpperCase(),
      discount_type: form.discount_type.value,
      discount_value: Number(form.discount_value.value || 0),
      min_subtotal: Number(form.min_subtotal.value || 0),
      usage_limit: form.usage_limit.value ? Number(form.usage_limit.value) : null,
      tier_gate: form.tier_gate.value,
      active: form.active.checked ? 1 : 0
    };
    const result = await apiPost('/api/admin/promotions', payload, true);
    notice('[data-promo-notice]', escapeHtml(result.message || 'Saved.'), result.ok ? 'success' : 'danger');
    if (result.ok) {
      form.reset();
      form.promo_code_id.value = '';
      await loadPromotions();
    }
  });


document.querySelector('[data-settings-form]')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = {}; ['store_notice_badge','store_notice','verify_scanner_hint','hero_eyebrow','hero_title','hero_copy','hero_cta_label','hero_cta_href','shipping_policy_html','returns_policy_html','exchange_policy_html','size_guide_html','support_intro','orders_intro'].forEach((key) => { if (form[key]) payload[key] = form[key].value.trim(); });
  const result = await apiPost('/api/admin/settings', payload, true);
  notice('[data-settings-notice]', escapeHtml(result.message || 'Saved.'), result.ok ? 'success' : 'danger');
  if (result.ok) await loadSettings();
});

document.querySelector('[data-settings-reset]')?.addEventListener('click', () => {
  const form = document.querySelector('[data-settings-form]');
  if (!form) return;
  const fields = ['store_notice_badge','store_notice','verify_scanner_hint','hero_eyebrow','hero_title','hero_copy','hero_cta_label','hero_cta_href','shipping_policy_html','returns_policy_html','exchange_policy_html','size_guide_html','support_intro','orders_intro'];
  fields.forEach((key) => { if (form[key]) form[key].value = state.settings[key] || ''; });
});


  document.querySelector('[data-staff-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = {
      id: form.staff_id.value || null,
      full_name: form.full_name.value.trim(),
      email: form.email.value.trim(),
      role: form.role.value,
      status: form.status.value,
      access_scope: form.access_scope.value.trim()
    };
    const result = await apiPost('/api/admin/staff', payload, true);
    notice('[data-staff-notice]', escapeHtml(result.message || 'Updated.'), result.ok ? 'success' : 'danger');
    if (result.ok) {
      form.reset();
      form.staff_id.value = '';
      form.role.value = 'operations';
      form.status.value = 'active';
      await loadStaff();
    }
  });

  document.querySelector('[data-staff-reset]')?.addEventListener('click', () => {
    const form = document.querySelector('[data-staff-form]');
    if (!form) return;
    form.reset();
    form.staff_id.value = '';
    form.role.value = 'operations';
    form.status.value = 'active';
  });

  document.querySelector("[data-image-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const file = form.image.files?.[0];
    if (!file) {
      notice("[data-images-notice]", "Choose an image first.", "danger");
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      const payload = {
        action: "upload",
        product_id: Number(form.product_id.value),
        sort_order: Number(form.sort_order.value || 0),
        data_url: dataUrl,
        alt_text: form.alt_text.value.trim(),
        is_primary: form.is_primary.checked ? 1 : 0
      };
      const result = await apiPost("/api/admin/product-images", payload, true);
      notice("[data-images-notice]", escapeHtml(result.message || "Uploaded."), result.ok ? "success" : "danger");
      if (result.ok) {
        form.reset();
        form.is_primary.checked = true;
        await loadImages(Number(payload.product_id));
        await loadProducts();
      }
    } catch (uploadError) {
      notice("[data-images-notice]", escapeHtml(uploadError.message || "Image upload failed."), "danger");
    }
  });
}

async function tryExistingAdminSession() {
  const res = await apiGet("/api/admin/auth/me", true);
  if (res.ok) {
    await refreshDashboard();
    return true;
  }
  return false;
}

document.addEventListener("DOMContentLoaded", async () => {
  bindForms();
  const hasSession = await tryExistingAdminSession();
  if (!hasSession) showShell(false);
});
