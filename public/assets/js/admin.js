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
      state.selectedProductId = product.id;
      document.querySelector('[data-product-id]').value = product.id;
      document.querySelector('[data-product-slug]').value = product.slug || '';
      document.querySelector('[data-product-short-code]').value = product.short_code || '';
      document.querySelector('[data-product-name]').value = product.name || '';
      document.querySelector('[data-product-category]').value = product.category || '';
      document.querySelector('[data-product-price-ngn]').value = product.price_ngn ?? '';
      document.querySelector('[data-product-price-usd]').value = product.price_usd ?? '';
      document.querySelector('[data-product-tagline]').value = product.tagline || '';
      document.querySelector('[data-product-description]').value = product.description || '';
      document.querySelector('[data-product-materials]').value = product.materials || '';
      document.querySelector('[data-product-fit-notes]').value = product.fit_notes || '';
      document.querySelector('[data-product-care]').value = product.care || '';
      document.querySelector('[data-image-product-id]').value = product.id;
      loadImages(product.id);
      populateVariantSelects(product.id);
      notice('[data-admin-product-notice]', `Editing ${escapeHtml(product.name)}`, 'success');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  document.querySelectorAll('[data-manage-images]').forEach((button) => {
    button.addEventListener('click', async () => {
      const productId = Number(button.dataset.manageImages);
      state.selectedProductId = productId;
      document.querySelector('[data-image-product-id]').value = productId;
      await loadImages(productId);
      window.scrollTo({ top: document.querySelector('[data-images-section]').offsetTop - 20, behavior: 'smooth' });
    });
  });

  document.querySelectorAll('[data-toggle-featured]').forEach((button) => {
    button.addEventListener('click', async () => {
      const productId = Number(button.dataset.toggleFeatured);
      const res = await apiPost('/api/admin/products', { action: 'toggle_featured', product_id: productId }, true);
      notice('[data-admin-product-notice]', res.message || 'Featured state updated.', res.ok ? 'success' : 'danger');
      if (res.ok) await loadProducts();
    });
  });

  document.querySelectorAll('[data-toggle-product]').forEach((button) => {
    button.addEventListener('click', async () => {
      const productId = Number(button.dataset.toggleProduct);
      const res = await apiPost('/api/admin/products', { action: 'toggle_active', product_id: productId }, true);
      notice('[data-admin-product-notice]', res.message || 'Product updated.', res.ok ? 'success' : 'danger');
      if (res.ok) await loadProducts();
    });
  });

  document.querySelectorAll('[data-delete-product]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!window.confirm('Delete this product? This also removes its variants, images, batches, and codes.')) return;
      const productId = Number(button.dataset.deleteProduct);
      const res = await apiPost('/api/admin/products', { action: 'delete', product_id: productId }, true);
      notice('[data-admin-product-notice]', res.message || 'Product deleted.', res.ok ? 'success' : 'danger');
      if (res.ok) {
        if (Number(state.selectedProductId) === Number(productId)) state.selectedProductId = null;
        await Promise.all([loadProducts(), loadVariants(), loadBatches(), loadCodes(), refreshDashboard()]);
      }
    });
  });
}

function bindVariantActions() {
  document.querySelectorAll('[data-edit-variant]').forEach((button) => {
    button.addEventListener('click', () => {
      const variant = state.variants.find((entry) => Number(entry.id) === Number(button.dataset.editVariant));
      if (!variant) return;
      document.querySelector('[data-variant-id]').value = variant.id;
      document.querySelector('[data-variant-product-id]').value = variant.product_id;
      document.querySelector('[data-variant-sku]').value = variant.sku || '';
      document.querySelector('[data-variant-color]').value = variant.color || '';
      document.querySelector('[data-variant-color-code]').value = variant.color_code || '';
      document.querySelector('[data-variant-size]').value = variant.size || '';
      document.querySelector('[data-variant-size-code]').value = variant.size_code || '';
      document.querySelector('[data-variant-stock]').value = variant.stock ?? 0;
      document.querySelector('[data-variant-price-ngn]').value = variant.price_ngn ?? 0;
      document.querySelector('[data-variant-price-usd]').value = variant.price_usd ?? 0;
      document.querySelector('[data-variant-active]').checked = Boolean(variant.active);
      notice('[data-admin-variant-notice]', `Editing ${escapeHtml(variant.sku)}`, 'success');
      window.scrollTo({ top: document.querySelector('[data-variant-form]').offsetTop - 20, behavior: 'smooth' });
    });
  });

  document.querySelectorAll('[data-delete-variant]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!window.confirm('Delete this variant?')) return;
      const variantId = Number(button.dataset.deleteVariant);
      const res = await apiPost('/api/admin/variants', { action: 'delete', variant_id: variantId }, true);
      notice('[data-admin-variant-notice]', res.message || 'Variant deleted.', res.ok ? 'success' : 'danger');
      if (res.ok) {
        await Promise.all([loadVariants(state.selectedProductId), loadProducts(), loadBatches(), loadCodes(), refreshDashboard()]);
      }
    });
  });
}

function bindImageActions() {
  document.querySelectorAll('[data-set-primary]').forEach((button) => {
    button.addEventListener('click', async () => {
      const imageId = Number(button.dataset.setPrimary);
      const productId = Number(document.querySelector('[data-image-product-id]').value);
      const res = await apiPost('/api/admin/product-images', { action: 'set_primary', image_id: imageId, product_id: productId }, true);
      notice('[data-admin-image-notice]', res.message || 'Primary image updated.', res.ok ? 'success' : 'danger');
      if (res.ok) {
        await Promise.all([loadImages(productId), loadProducts()]);
      }
    });
  });

  document.querySelectorAll('[data-delete-image]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!window.confirm('Delete this image?')) return;
      const imageId = Number(button.dataset.deleteImage);
      const productId = Number(document.querySelector('[data-image-product-id]').value);
      const res = await apiPost('/api/admin/product-images', { action: 'delete', image_id: imageId }, true);
      notice('[data-admin-image-notice]', res.message || 'Image deleted.', res.ok ? 'success' : 'danger');
      if (res.ok) {
        await Promise.all([loadImages(productId), loadProducts()]);
      }
    });
  });
}

function bindOrderActions() {
  document.querySelectorAll('[data-save-order]').forEach((button) => {
    button.addEventListener('click', async () => {
      const orderId = Number(button.dataset.saveOrder);
      const status = document.querySelector(`[data-order-status-select="${orderId}"]`).value;
      const res = await apiPost('/api/admin/orders', { action: 'update_status', order_id: orderId, status }, true);
      notice('[data-admin-order-notice]', res.message || 'Order updated.', res.ok ? 'success' : 'danger');
      if (res.ok) await loadOrders();
    });
  });
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read file.'));
    reader.readAsDataURL(file);
  });
}

function bindForms() {
  document.querySelector('[data-admin-login-form]').addEventListener('submit', async (event) => {
    event.preventDefault();
    const token = document.querySelector('[data-admin-token]').value.trim();
    if (!token) return showAuthNotice('Enter your admin token.');
    setAdminToken(token);
    await refreshDashboard();
  });

  document.querySelector('[data-product-form]').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = {
      action: 'upsert',
      product_id: form.product_id.value ? Number(form.product_id.value) : null,
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
      care: form.care.value.trim()
    };
    const res = await apiPost('/api/admin/products', payload, true);
    notice('[data-admin-product-notice]', res.message || 'Product saved.', res.ok ? 'success' : 'danger');
    if (res.ok) {
      if (res.product_id) {
        form.product_id.value = res.product_id;
        state.selectedProductId = res.product_id;
        document.querySelector('[data-image-product-id]').value = res.product_id;
      }
      await Promise.all([loadProducts(), loadVariants(state.selectedProductId), refreshDashboard()]);
    }
  });

  document.querySelector('[data-reset-product-form]').addEventListener('click', () => {
    document.querySelector('[data-product-form]').reset();
    document.querySelector('[data-product-id]').value = '';
    notice('[data-admin-product-notice]', 'Product form reset.', 'success');
  });

  document.querySelector('[data-variant-form]').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = {
      action: 'upsert',
      variant_id: form.variant_id.value ? Number(form.variant_id.value) : null,
      product_id: Number(form.product_id.value),
      sku: form.sku.value.trim(),
      color: form.color.value.trim(),
      color_code: form.color_code.value.trim(),
      size: form.size.value.trim(),
      size_code: form.size_code.value.trim(),
      stock: Number(form.stock.value || 0),
      price_ngn: Number(form.price_ngn.value || 0),
      price_usd: Number(form.price_usd.value || 0),
      active: form.active.checked
    };
    const res = await apiPost('/api/admin/variants', payload, true);
    notice('[data-admin-variant-notice]', res.message || 'Variant saved.', res.ok ? 'success' : 'danger');
    if (res.ok) {
      form.reset();
      form.variant_id.value = '';
      await Promise.all([loadVariants(state.selectedProductId), loadProducts(), refreshDashboard()]);
    }
  });

  document.querySelector('[data-reset-variant-form]').addEventListener('click', () => {
    const form = document.querySelector('[data-variant-form]');
    form.reset();
    form.variant_id.value = '';
    notice('[data-admin-variant-notice]', 'Variant form reset.', 'success');
  });

  document.querySelector('[data-image-product-id]').addEventListener('change', async (event) => {
    state.selectedProductId = Number(event.target.value) || null;
    populateVariantSelects(state.selectedProductId);
    await loadImages(state.selectedProductId);
  });

  document.querySelector('[data-image-upload-form]').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const productId = Number(form.product_id.value);
    const files = Array.from(form.images.files || []);
    if (!productId) return notice('[data-admin-image-notice]', 'Select a product first.', 'danger');
    if (!files.length) return notice('[data-admin-image-notice]', 'Choose at least one image.', 'danger');

    notice('[data-admin-image-notice]', 'Uploading images...', 'success');
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const dataUrl = await readFileAsDataURL(file);
      const payload = {
        action: 'upload',
        product_id: productId,
        data_url: dataUrl,
        alt_text: form.alt_text.value.trim() || `${state.products.find((entry) => Number(entry.id) === Number(productId))?.name || 'Product'} image`,
        is_primary: form.is_primary.checked && index === 0,
        sort_order: index
      };
      const res = await apiPost('/api/admin/product-images', payload, true);
      if (!res.ok) return notice('[data-admin-image-notice]', res.message || 'Image upload failed.', 'danger');
    }

    form.reset();
    await Promise.all([loadImages(productId), loadProducts()]);
    notice('[data-admin-image-notice]', 'Images uploaded.', 'success');
  });

  document.querySelector('[data-batch-product-id]').addEventListener('change', (event) => {
    populateVariantSelects(Number(event.target.value) || null);
  });

  document.querySelector('[data-batch-form]').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = {
      product_id: Number(form.product_id.value),
      variant_id: form.variant_id.value ? Number(form.variant_id.value) : null,
      factory_name: form.factory_name.value.trim(),
      quantity: Number(form.quantity.value || 0),
      status: form.status.value,
      manufactured_at: form.manufactured_at.value,
      notes: form.notes.value.trim()
    };
    const res = await apiPost('/api/admin/batches', payload, true);
    notice('[data-admin-batch-notice]', res.message || 'Batch created.', res.ok ? 'success' : 'danger');
    if (res.ok) {
      form.reset();
      await Promise.all([loadBatches(), refreshDashboard()]);
    }
  });

  document.querySelector('[data-generate-codes-form]').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = {
      batch_id: Number(form.batch_id.value),
      quantity: Number(form.quantity.value || 0)
    };
    const res = await apiPost('/api/admin/codes/generate', payload, true);
    notice('[data-admin-code-notice]', res.message || 'Codes generated.', res.ok ? 'success' : 'danger');
    if (res.ok) {
      document.querySelector('[data-generated-codes]').value = (res.codes || []).join('\n');
      await Promise.all([loadCodes(), refreshDashboard()]);
    }
  });

  document.querySelector('[data-activate-codes-form]').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const codes = form.codes.value.split('\n').map((entry) => entry.trim()).filter(Boolean);
    const res = await apiPost('/api/admin/codes/activate', { codes }, true);
    notice('[data-admin-code-notice]', res.message || 'Codes activated.', res.ok ? 'success' : 'danger');
    if (res.ok) await Promise.all([loadCodes(), refreshDashboard()]);
  });
}

async function initialiseAdmin() {
  bindForms();
  const token = getAdminToken();
  if (token) {
    document.querySelector('[data-admin-token]').value = token;
    await refreshDashboard();
  }
}

initialiseAdmin();
