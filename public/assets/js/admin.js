import { apiGet, apiPost, escapeHtml, formatNGN, formatUSD, getAdminToken, setAdminToken } from "./api.js";

const state = {
  products: [],
  variants: [],
  orders: [],
  selectedProductId: null,
  selectedImages: []
};

function notice(selector, message, variant = 'success') {
  const mount = document.querySelector(selector);
  if (!mount) return;
  mount.innerHTML = `<div class="notice notice-${variant}">${message}</div>`;
  if (message) {
    setTimeout(() => {
      if (mount.innerHTML.includes(message)) mount.innerHTML = '';
    }, 4000);
  }
}

function renderSummary(summary) {
  document.querySelector("[data-summary-products]").textContent = summary.products ?? 0;
  document.querySelector("[data-summary-batches]").textContent = summary.batches ?? 0;
  document.querySelector("[data-summary-codes]").textContent = summary.codes ?? 0;
  document.querySelector("[data-summary-issues]").textContent = summary.openIssues ?? 0;
  document.querySelector("[data-summary-orders]").textContent = summary.orders ?? 0;
  document.querySelector("[data-summary-low-stock]").textContent = summary.lowStock ?? 0;
}

function showAuthNotice(message) {
  const noticeMount = document.querySelector("[data-login-notice]");
  noticeMount.innerHTML = `<div class="notice notice-danger">${message}</div>`;
}

function populateProductSelects() {
  const options = [`<option value="">Select product</option>`].concat(state.products.map((product) => `<option value="${product.id}">${escapeHtml(product.name)} (#${product.id})</option>`));
  document.querySelectorAll('[data-product-select]').forEach((select) => {
    const current = select.value;
    select.innerHTML = options.join('');
    if (current) select.value = current;
  });
}

function populateVariantSelects(productId = null) {
  const filtered = productId ? state.variants.filter((variant) => Number(variant.product_id) === Number(productId)) : state.variants;
  const options = [`<option value="">Select variant</option>`].concat(filtered.map((variant) => `<option value="${variant.id}">${escapeHtml(variant.sku)} · ${escapeHtml(variant.color)} / ${escapeHtml(variant.size)}</option>`));
  document.querySelectorAll('[data-variant-select]').forEach((select) => {
    const current = select.value;
    select.innerHTML = options.join('');
    if (current) select.value = current;
  });
}

function productCard(product) {
  const image = product.primary_image_url ? `<img src="${product.primary_image_url}" alt="${escapeHtml(product.name)}">` : `<div class="image-placeholder">${escapeHtml(product.short_code)}</div>`;
  return `
    <article class="admin-card">
      <div class="admin-card-media">${image}</div>
      <div class="admin-card-body">
        <div class="admin-card-head">
          <div>
            <strong>${escapeHtml(product.name)}</strong>
            <div class="muted">#${product.id} · ${escapeHtml(product.slug)} · ${escapeHtml(product.short_code)}</div>
          </div>
          <span class="pill">${product.active ? 'Live' : 'Hidden'}</span>
        </div>
        <div class="muted">${formatNGN(product.price_ngn)} · ${formatUSD(product.price_usd)} · ${product.image_count || 0} image(s) · ${product.variant_count || 0} variant(s)</div>
        <div class="admin-actions compact">
          <button class="btn btn-soft" type="button" data-edit-product="${product.id}">Edit</button>
          <button class="btn btn-soft" type="button" data-manage-images="${product.id}">Images</button>
          <button class="btn btn-soft" type="button" data-toggle-featured="${product.id}">${product.featured ? 'Unfeature' : 'Feature'}</button>
          <button class="btn btn-soft" type="button" data-toggle-product="${product.id}">${product.active ? 'Hide' : 'Show'}</button>
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
      </div>
      <div class="admin-actions compact">
        <span class="pill">Stock ${variant.stock}</span>
        <button class="btn btn-soft" type="button" data-edit-variant="${variant.id}">Edit</button>
        <button class="btn btn-danger" type="button" data-delete-variant="${variant.id}">Delete</button>
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
          ${['pending','awaiting_payment','paid','processing','shipped','delivered','cancelled','payment_failed'].map((status) => `<option value="${status}" ${order.status === status ? 'selected' : ''}>${status}</option>`).join('')}
        </select>
        <button class="btn btn-soft" type="button" data-save-order="${order.id}">Save</button>
      </div>
    </article>
  `;
}

function imageCard(image) {
  return `
    <article class="media-card">
      <img src="${image.data_url}" alt="${escapeHtml(image.alt_text || 'Product image')}">
      <div class="media-card-body">
        <div class="muted">${image.is_primary ? 'Primary image' : 'Gallery image'}</div>
        <div class="admin-actions compact">
          <button class="btn btn-soft" type="button" data-set-primary="${image.id}">Make primary</button>
          <button class="btn btn-danger" type="button" data-delete-image="${image.id}">Delete</button>
        </div>
      </div>
    </article>
  `;
}

async function refreshDashboard() {
  const summary = await apiGet('/api/admin/dashboard', true);
  if (!summary.ok) {
    showAuthNotice(summary.message || 'Admin access failed.');
    return;
  }
  document.querySelector('[data-admin-shell]').classList.remove('hide');
  document.querySelector('[data-login-panel]').classList.add('hide');
  renderSummary(summary.summary || {});
  await Promise.all([loadProducts(), loadVariants(), loadBatches(), loadCodes(), loadIssues(), loadOrders()]);
}

async function loadProducts() {
  const res = await apiGet('/api/admin/products', true);
  const mount = document.querySelector('[data-admin-products]');
  if (!res.ok) {
    mount.innerHTML = `<div class="empty-state">${res.message}</div>`;
    return;
  }
  state.products = res.products || [];
  populateProductSelects();
  mount.innerHTML = state.products.length ? state.products.map(productCard).join('') : `<div class="empty-state">No products yet.</div>`;
  bindProductActions();
  if (!state.selectedProductId && state.products[0]) {
    state.selectedProductId = state.products[0].id;
  }
  document.querySelector('[data-image-product-id]').value = state.selectedProductId || '';
  document.querySelector('[data-batch-product-id]')?.value || '';
  populateVariantSelects(state.selectedProductId);
  if (state.selectedProductId) await loadImages(state.selectedProductId);
}

async function loadVariants(productId = '') {
  const url = productId ? `/api/admin/variants?product_id=${encodeURIComponent(productId)}` : '/api/admin/variants';
  const res = await apiGet(url, true);
  const mount = document.querySelector('[data-admin-variants]');
  if (!res.ok) {
    mount.innerHTML = `<div class="empty-state">${res.message}</div>`;
    return;
  }
  state.variants = res.variants || [];
  populateVariantSelects(state.selectedProductId);
  mount.innerHTML = state.variants.length ? state.variants.map(variantCard).join('') : `<div class="empty-state">No variants yet.</div>`;
  bindVariantActions();
}

async function loadImages(productId) {
  const mount = document.querySelector('[data-admin-images]');
  const title = document.querySelector('[data-images-title]');
  if (!productId) {
    mount.innerHTML = `<div class="empty-state">Select a product to manage its images.</div>`;
    title.textContent = 'Product images';
    return;
  }
  const product = state.products.find((entry) => Number(entry.id) === Number(productId));
  title.textContent = product ? `Images — ${product.name}` : 'Product images';
  const res = await apiGet(`/api/admin/product-images?product_id=${encodeURIComponent(productId)}`, true);
  if (!res.ok) {
    mount.innerHTML = `<div class="empty-state">${res.message}</div>`;
    return;
  }
  state.selectedImages = res.images || [];
  mount.innerHTML = state.selectedImages.length ? state.selectedImages.map(imageCard).join('') : `<div class="empty-state">No images yet. Upload your first cloth photo here.</div>`;
  bindImageActions();
}

async function loadBatches() {
  const res = await apiGet('/api/admin/batches', true);
  const mount = document.querySelector('[data-admin-batches]');
  if (!res.ok) {
    mount.innerHTML = `<div class="empty-state">${res.message}</div>`;
    return;
  }
  mount.innerHTML = (res.batches || []).map((batch) => `
    <article class="simple-row">
      <strong>${batch.batch_code}</strong>
      <span class="muted">${batch.product_name}${batch.color ? ` · ${batch.color}` : ''}${batch.size ? ` / ${batch.size}` : ''}</span>
      <span class="muted">${batch.quantity} pcs · ${batch.factory_name || 'Factory not set'} · ${batch.status}</span>
    </article>
  `).join('');
}

async function loadCodes() {
  const res = await apiGet('/api/admin/codes', true);
  const mount = document.querySelector('[data-admin-codes]');
  if (!res.ok) {
    mount.innerHTML = `<div class="empty-state">${res.message}</div>`;
    return;
  }
  mount.innerHTML = (res.codes || []).slice(0, 20).map((code) => `
    <article class="code-row">
      <strong>${code.serial_code}</strong>
      <span class="muted">${code.product_name} · ${code.color || 'Standard'} / ${code.size || 'OS'}</span>
      <span class="muted">${code.status} · scans: ${code.scan_count}</span>
    </article>
  `).join('');
}

async function loadIssues() {
  const res = await apiGet('/api/admin/issues', true);
  const mount = document.querySelector('[data-admin-issues]');
  if (!res.ok) {
    mount.innerHTML = `<div class="empty-state">${res.message}</div>`;
    return;
  }
  mount.innerHTML = (res.issues || []).slice(0, 20).map((issue) => `
    <article class="issue-row">
      <strong>${issue.issue_type}</strong>
      <span class="muted">${issue.email}</span>
      <span class="muted">${escapeHtml(issue.message || '')}</span>
    </article>
  `).join('');
}

async function loadOrders() {
  const res = await apiGet('/api/admin/orders', true);
  const mount = document.querySelector('[data-admin-orders]');
  if (!res.ok) {
    mount.innerHTML = `<div class="empty-state">${res.message}</div>`;
    return;
  }
  state.orders = res.orders || [];
  mount.innerHTML = state.orders.length ? state.orders.map(orderCard).join('') : `<div class="empty-state">No orders yet.</div>`;
  bindOrderActions();
}

function bindProductActions() {
  document.querySelectorAll('[data-edit-product]').forEach((button) => {
    button.addEventListener('click', () => {
      const product = state.products.find((entry) => Number(entry.id) === Number(button.dataset.editProduct));
      if (!product) return;
      const form = document.querySelector('[data-product-form]');
      form.product_id.value = product.id;
      form.slug.value = product.slug;
      form.short_code.value = product.short_code;
      form.name.value = product.name;
      form.category.value = product.category || '';
      form.price_ngn.value = product.price_ngn;
      form.price_usd.value = product.price_usd;
      form.tagline.value = product.tagline || '';
      form.description.value = product.description || '';
      form.materials.value = product.materials || '';
      form.fit_notes.value = product.fit_notes || '';
      form.care.value = product.care || '';
      form.active.checked = Number(product.active) === 1;
      form.featured.checked = Number(product.featured) === 1;
      document.querySelector('[data-product-submit]').textContent = 'Update product';
      notice('[data-product-notice]', `Loaded ${product.name} into the editor.`);
    });
  });

  document.querySelectorAll('[data-manage-images]').forEach((button) => {
    button.addEventListener('click', async () => {
      state.selectedProductId = Number(button.dataset.manageImages);
      document.querySelector('[data-image-product-id]').value = state.selectedProductId;
      populateVariantSelects(state.selectedProductId);
      await loadImages(state.selectedProductId);
      notice('[data-images-notice]', 'Image manager switched to selected product.');
    });
  });

  document.querySelectorAll('[data-toggle-product]').forEach((button) => {
    button.addEventListener('click', async () => {
      const result = await apiPost('/api/admin/products', { action: 'toggle_active', id: Number(button.dataset.toggleProduct) }, true);
      notice('[data-global-notice]', result.message || 'Product status updated.', result.ok ? 'success' : 'danger');
      if (result.ok) await refreshDashboard();
    });
  });

  document.querySelectorAll('[data-toggle-featured]').forEach((button) => {
    button.addEventListener('click', async () => {
      const result = await apiPost('/api/admin/products', { action: 'toggle_featured', id: Number(button.dataset.toggleFeatured) }, true);
      notice('[data-global-notice]', result.message || 'Featured status updated.', result.ok ? 'success' : 'danger');
      if (result.ok) await refreshDashboard();
    });
  });

  document.querySelectorAll('[data-delete-product]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!confirm('Delete this product, its variants, batches, and codes?')) return;
      const result = await apiPost('/api/admin/products', { action: 'delete', id: Number(button.dataset.deleteProduct) }, true);
      notice('[data-global-notice]', result.message || 'Product deleted.', result.ok ? 'success' : 'danger');
      if (result.ok) {
        if (state.selectedProductId === Number(button.dataset.deleteProduct)) state.selectedProductId = null;
        await refreshDashboard();
      }
    });
  });
}

function bindVariantActions() {
  document.querySelectorAll('[data-edit-variant]').forEach((button) => {
    button.addEventListener('click', () => {
      const variant = state.variants.find((entry) => Number(entry.id) === Number(button.dataset.editVariant));
      if (!variant) return;
      const form = document.querySelector('[data-variant-form]');
      form.variant_id.value = variant.id;
      form.product_id.value = variant.product_id;
      form.sku.value = variant.sku;
      form.color.value = variant.color;
      form.color_code.value = variant.color_code;
      form.size.value = variant.size;
      form.size_code.value = variant.size_code;
      form.stock.value = variant.stock;
      form.price_ngn.value = variant.price_ngn ?? '';
      form.price_usd.value = variant.price_usd ?? '';
      form.active.checked = Number(variant.active) === 1;
      document.querySelector('[data-variant-submit]').textContent = 'Update variant';
      notice('[data-variant-notice]', `Loaded ${variant.sku} into the editor.`);
    });
  });

  document.querySelectorAll('[data-delete-variant]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!confirm('Delete this variant?')) return;
      const result = await apiPost('/api/admin/variants', { action: 'delete', id: Number(button.dataset.deleteVariant) }, true);
      notice('[data-global-notice]', result.message || 'Variant deleted.', result.ok ? 'success' : 'danger');
      if (result.ok) await Promise.all([loadProducts(), loadVariants(state.selectedProductId)]);
    });
  });
}

function bindImageActions() {
  document.querySelectorAll('[data-set-primary]').forEach((button) => {
    button.addEventListener('click', async () => {
      const result = await apiPost('/api/admin/product-images', { action: 'set_primary', image_id: Number(button.dataset.setPrimary), product_id: state.selectedProductId }, true);
      notice('[data-images-notice]', result.message || 'Primary image updated.', result.ok ? 'success' : 'danger');
      if (result.ok) {
        await Promise.all([loadImages(state.selectedProductId), loadProducts()]);
      }
    });
  });

  document.querySelectorAll('[data-delete-image]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!confirm('Delete this image?')) return;
      const result = await apiPost('/api/admin/product-images', { action: 'delete', image_id: Number(button.dataset.deleteImage) }, true);
      notice('[data-images-notice]', result.message || 'Image deleted.', result.ok ? 'success' : 'danger');
      if (result.ok) {
        await Promise.all([loadImages(state.selectedProductId), loadProducts()]);
      }
    });
  });
}

function bindOrderActions() {
  document.querySelectorAll('[data-save-order]').forEach((button) => {
    button.addEventListener('click', async () => {
      const id = Number(button.dataset.saveOrder);
      const status = document.querySelector(`[data-order-status-select="${id}"]`).value;
      const result = await apiPost('/api/admin/orders', { id, status }, true);
      notice('[data-global-notice]', result.message || 'Order updated.', result.ok ? 'success' : 'danger');
      if (result.ok) await loadOrders();
    });
  });
}

async function compressImage(file, maxWidth = 1600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function resetProductForm() {
  const form = document.querySelector('[data-product-form]');
  form.reset();
  form.product_id.value = '';
  form.active.checked = true;
  form.featured.checked = false;
  document.querySelector('[data-product-submit]').textContent = 'Save product';
}

function resetVariantForm() {
  const form = document.querySelector('[data-variant-form]');
  form.reset();
  form.variant_id.value = '';
  form.active.checked = true;
  document.querySelector('[data-variant-submit]').textContent = 'Save variant';
  if (state.selectedProductId) form.product_id.value = state.selectedProductId;
}

function setupForms() {
  document.querySelector('[data-login-form]').addEventListener('submit', async (event) => {
    event.preventDefault();
    const token = event.currentTarget.token.value.trim();
    if (!token) return;
    setAdminToken(token);
    await refreshDashboard();
  });

  document.querySelector('[data-product-form]').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = {
      id: form.product_id.value ? Number(form.product_id.value) : null,
      slug: form.slug.value.trim(),
      short_code: form.short_code.value.trim(),
      name: form.name.value.trim(),
      category: form.category.value.trim(),
      price_ngn: Number(form.price_ngn.value),
      price_usd: Number(form.price_usd.value),
      tagline: form.tagline.value.trim(),
      description: form.description.value.trim(),
      materials: form.materials.value.trim(),
      fit_notes: form.fit_notes.value.trim(),
      care: form.care.value.trim(),
      active: form.active.checked ? 1 : 0,
      featured: form.featured.checked ? 1 : 0
    };
    const result = await apiPost('/api/admin/products', payload, true);
    notice('[data-product-notice]', result.message || 'Saved.', result.ok ? 'success' : 'danger');
    if (result.ok) {
      if (result.productId) {
        state.selectedProductId = result.productId;
        document.querySelector('[data-image-product-id]').value = result.productId;
      }
      resetProductForm();
      await refreshDashboard();
    }
  });

  document.querySelector('[data-product-reset]').addEventListener('click', (event) => {
    event.preventDefault();
    resetProductForm();
    notice('[data-product-notice]', 'Product editor reset.');
  });

  document.querySelector('[data-variant-form]').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = {
      id: form.variant_id.value ? Number(form.variant_id.value) : null,
      product_id: Number(form.product_id.value),
      sku: form.sku.value.trim(),
      color: form.color.value.trim(),
      color_code: form.color_code.value.trim(),
      size: form.size.value.trim(),
      size_code: form.size_code.value.trim(),
      stock: Number(form.stock.value || 0),
      price_ngn: form.price_ngn.value === '' ? null : Number(form.price_ngn.value),
      price_usd: form.price_usd.value === '' ? null : Number(form.price_usd.value),
      active: form.active.checked ? 1 : 0
    };
    const result = await apiPost('/api/admin/variants', payload, true);
    notice('[data-variant-notice]', result.message || 'Variant saved.', result.ok ? 'success' : 'danger');
    if (result.ok) {
      resetVariantForm();
      await Promise.all([loadProducts(), loadVariants(state.selectedProductId)]);
    }
  });

  document.querySelector('[data-variant-reset]').addEventListener('click', (event) => {
    event.preventDefault();
    resetVariantForm();
    notice('[data-variant-notice]', 'Variant editor reset.');
  });

  document.querySelector('[data-image-form]').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const productId = Number(form.product_id.value);
    const file = form.image.files[0];
    if (!productId || !file) {
      notice('[data-images-notice]', 'Select a product and choose an image file first.', 'danger');
      return;
    }
    const dataUrl = await compressImage(file);
    const result = await apiPost('/api/admin/product-images', {
      action: 'upload',
      product_id: productId,
      data_url: dataUrl,
      alt_text: form.alt_text.value.trim(),
      is_primary: form.is_primary.checked ? 1 : 0,
      sort_order: Number(form.sort_order.value || 0)
    }, true);
    notice('[data-images-notice]', result.message || 'Image uploaded.', result.ok ? 'success' : 'danger');
    if (result.ok) {
      state.selectedProductId = productId;
      form.reset();
      await Promise.all([loadImages(productId), loadProducts()]);
    }
  });

  document.querySelector('[data-image-product-id]').addEventListener('change', async (event) => {
    state.selectedProductId = Number(event.currentTarget.value || 0) || null;
    populateVariantSelects(state.selectedProductId);
    await loadImages(state.selectedProductId);
  });

  document.querySelector('[data-batch-form]').addEventListener('submit', async (event) => {
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
    const result = await apiPost('/api/admin/batches', payload, true);
    notice('[data-batch-notice]', result.message || 'Batch created.', result.ok ? 'success' : 'danger');
    if (result.ok) {
      form.reset();
      await Promise.all([loadBatches(), loadProducts()]);
    }
  });

  document.querySelector('[data-batch-product-id]').addEventListener('change', (event) => {
    populateVariantSelects(event.currentTarget.value);
  });

  document.querySelector('[data-generate-form]').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const result = await apiPost('/api/admin/codes', {
      action: 'generate',
      batch_id: Number(form.batch_id.value),
      quantity: Number(form.quantity.value)
    }, true);
    notice('[data-codes-notice]', result.message || 'Codes generated.', result.ok ? 'success' : 'danger');
    if (result.ok) {
      form.reset();
      await loadCodes();
    }
  });

  document.querySelector('[data-activate-form]').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const codes = form.codes.value.split('
').map((entry) => entry.trim()).filter(Boolean);
    const result = await apiPost('/api/admin/codes', { action: 'activate', codes }, true);
    notice('[data-codes-notice]', result.message || 'Codes updated.', result.ok ? 'success' : 'danger');
    if (result.ok) {
      form.reset();
      await loadCodes();
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  setupForms();
  if (getAdminToken()) {
    await refreshDashboard();
  }
});
