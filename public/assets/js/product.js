import { addToCart, apiGet, escapeHtml, localizePriceFromUSD, qs } from './api.js';

function groupVariants(variants) {
  return {
    colors: [...new Set(variants.map((v) => v.color))],
    sizes: [...new Set(variants.map((v) => v.size))]
  };
}

function buildGallery(images, fallback) {
  if (!images?.length) return `<article class="product-hero">${escapeHtml(fallback)}</article>`;
  const primary = images[0];
  return `
    <div class="product-gallery">
      <article class="product-hero product-hero-media"><img src="${primary.data_url}" alt="${escapeHtml(primary.alt_text || fallback)}"></article>
      <div class="thumb-strip">
        ${images.map((image) => `<button class="thumb-btn ${image.is_primary ? 'is-active' : ''}" type="button" data-gallery-url="${image.data_url}" data-gallery-alt="${escapeHtml(image.alt_text || fallback)}"><img src="${image.data_url}" alt="${escapeHtml(image.alt_text || fallback)}"></button>`).join('')}
      </div>
    </div>
  `;
}

function stockBadge(totalStock) {
  if (totalStock <= 0) return '<span class="pill pill-stock soldout">Sold out</span>';
  if (totalStock <= 5) return `<span class="pill pill-stock limited">Only ${totalStock} left</span>`;
  return `<span class="pill pill-stock in">${totalStock} available now</span>`;
}

async function loadProduct() {
  const slug = qs('slug');
  const mount = document.querySelector('[data-product-view]');
  if (!mount) return;
  if (!slug) {
    mount.innerHTML = `<div class="notice notice-danger">No product selected.</div>`;
    return;
  }

  const data = await apiGet(`/api/products/${encodeURIComponent(slug)}`);
  if (!data.ok || !data.product) {
    mount.innerHTML = `<div class="notice notice-danger">Product not found.</div>`;
    return;
  }

  const { product } = data;
  const { colors, sizes } = groupVariants(product.variants);
  const firstVariant = product.variants[0];
  const localPrice = await localizePriceFromUSD(product.price_usd, product.compare_at_usd);

  mount.innerHTML = `
    <div class="split-grid product-split">
      ${buildGallery(product.images, product.short_code)}
      <article class="panel luxury-panel">
        <div class="eyebrow">${escapeHtml(product.category)}</div>
        <h1 style="font-size: clamp(2rem, 5vw, 4rem);">${escapeHtml(product.name)}</h1>
        <p class="lead">${escapeHtml(product.description)}</p>
        <div class="product-meta product-meta-strong">
          <span class="pill">${escapeHtml(product.short_code)}</span>
          ${product.collection_label ? `<span class="pill">${escapeHtml(product.collection_label)}</span>` : ''}
          ${stockBadge(Number(product.total_stock || 0))}
          ${product.mood_label ? `<span class="pill">${escapeHtml(product.mood_label)}</span>` : ''}
        </div>
        <div class="price-line">
          <span class="price-main">${localPrice.formatted}</span>
          <span class="price-alt">${Number(product.price_usd || 0).toFixed(2)} USD base</span>
          ${localPrice.formattedCompare ? `<span class="price-compare">${localPrice.formattedCompare}</span>` : ''}
        </div>
        <div class="divider"></div>
        <div class="details-list">
          <article><strong>Fit</strong><p class="muted">${escapeHtml(product.fit_notes || 'Slightly relaxed premium fit.')}</p></article>
          <article><strong>Materials</strong><p class="muted">${escapeHtml(product.materials || 'Premium fabric build.')}</p></article>
          <article><strong>Care</strong><p class="muted">${escapeHtml(product.care || 'Follow the care label for best lifespan.')}</p></article>
          <article><strong>Support</strong><p class="muted">Need help before or after purchase? Contact support@lifetime-store.shop.</p></article>
        </div>
        <form data-add-cart-form>
          <label>Color<select name="color">${colors.map((color) => `<option value="${escapeHtml(color)}">${escapeHtml(color)}</option>`).join('')}</select></label>
          <label>Size<select name="size">${sizes.map((size) => `<option value="${escapeHtml(size)}">${escapeHtml(size)}</option>`).join('')}</select></label>
          <label>Quantity<input type="number" name="quantity" value="1" min="1" max="20"></label>
          <div class="notice notice-warning hide" data-stock-warning></div>
          <div class="inline-actions">
            <button class="btn btn-primary" type="submit" data-cart-submit>Add to Cart</button>
            <a class="btn btn-soft" href="/verify.html">Authenticity Promise</a>
          </div>
        </form>
      </article>
    </div>
  `;

  const hero = mount.querySelector('.product-hero-media img');
  mount.querySelectorAll('[data-gallery-url]').forEach((button) => button.addEventListener('click', () => {
    mount.querySelectorAll('.thumb-btn').forEach((thumb) => thumb.classList.remove('is-active'));
    button.classList.add('is-active');
    if (hero) {
      hero.src = button.dataset.galleryUrl;
      hero.alt = button.dataset.galleryAlt;
    }
  }));

  const form = mount.querySelector('[data-add-cart-form]');
  const warning = mount.querySelector('[data-stock-warning]');
  const submitBtn = mount.querySelector('[data-cart-submit]');

  function refreshVariantState() {
    const color = form.color.value;
    const size = form.size.value;
    const variant = product.variants.find((entry) => entry.color === color && entry.size === size) || firstVariant;
    const stock = Number(variant?.stock || 0);
    form.quantity.max = stock > 0 ? String(stock) : '1';
    if (stock <= 0) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sold out';
      warning.classList.remove('hide');
      warning.textContent = 'This size and color is currently sold out.';
    } else {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Add to Cart';
      warning.classList.remove('hide');
      warning.textContent = stock <= 5 ? `Only ${stock} left in this variant.` : `${stock} available in this variant.`;
    }
  }

  form.color.addEventListener('change', refreshVariantState);
  form.size.addEventListener('change', refreshVariantState);
  refreshVariantState();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const color = form.color.value;
    const size = form.size.value;
    const quantity = Number(form.quantity.value || 1);
    const variant = product.variants.find((entry) => entry.color === color && entry.size === size) || firstVariant;
    if (!variant || Number(variant.stock || 0) < quantity || Number(variant.stock || 0) <= 0) {
      warning.classList.remove('hide');
      warning.textContent = 'Selected quantity is not available right now.';
      return;
    }
    await addToCart({
      key: `${product.slug}:${variant.id}`,
      product_id: product.id,
      variant_id: variant.id,
      product_name: product.name,
      slug: product.slug,
      sku: variant.sku,
      color: variant.color,
      size: variant.size,
      quantity,
      unit_price: variant.price_ngn || product.price_ngn,
      currency: 'NGN',
      stock: Number(variant.stock || 0)
    });
    form.quantity.value = '1';
    alert('Added to cart.');
    refreshVariantState();
  });
}

document.addEventListener('DOMContentLoaded', loadProduct);
