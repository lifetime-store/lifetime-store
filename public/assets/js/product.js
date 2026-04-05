import { addToCart, apiGet, escapeHtml, formatNGN, formatUSD, qs } from "./api.js";

function groupVariants(variants) {
  const colors = [...new Set(variants.map((v) => v.color))];
  const sizes = [...new Set(variants.map((v) => v.size))];
  return { colors, sizes };
}

function buildGallery(images, fallback) {
  if (!images?.length) {
    return `<article class="product-hero">${escapeHtml(fallback)}</article>`;
  }
  const primary = images[0];
  return `
    <div class="product-gallery">
      <article class="product-hero product-hero-media"><img src="${primary.data_url}" alt="${escapeHtml(primary.alt_text || fallback)}"></article>
      <div class="thumb-strip">
        ${images.map((image) => `<button class="thumb-btn ${image.is_primary ? 'is-active' : ''}" type="button" data-gallery-image="${image.id}" data-gallery-url="${image.data_url}" data-gallery-alt="${escapeHtml(image.alt_text || fallback)}"><img src="${image.data_url}" alt="${escapeHtml(image.alt_text || fallback)}"></button>`).join('')}
      </div>
    </div>
  `;
}

async function loadProduct() {
  const slug = qs("slug");
  const mount = document.querySelector("[data-product-view]");
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

  mount.innerHTML = `
    <div class="split-grid product-split">
      ${buildGallery(product.images, product.short_code)}
      <article class="panel">
        <div class="eyebrow">${escapeHtml(product.category)}</div>
        <h1 style="font-size: clamp(2rem, 5vw, 4rem);">${escapeHtml(product.name)}</h1>
        <p class="lead">${escapeHtml(product.description)}</p>
        <div class="price-line">
          <span class="price-main">${formatNGN(product.price_ngn)}</span>
          <span class="price-alt">${formatUSD(product.price_usd)}</span>
        </div>
        <div class="divider"></div>
        <div class="details-list">
          <article>
            <strong>Fit</strong>
            <p class="muted">${escapeHtml(product.fit_notes || 'Slightly relaxed premium fit.')}</p>
          </article>
          <article>
            <strong>Materials</strong>
            <p class="muted">${escapeHtml(product.materials || 'Premium fabric build.')}</p>
          </article>
          <article>
            <strong>Care</strong>
            <p class="muted">${escapeHtml(product.care || 'Follow the care label for best lifespan.')}</p>
          </article>
        </div>
        <form data-add-cart-form>
          <label>Color
            <select name="color">
              ${colors.map((color) => `<option value="${escapeHtml(color)}">${escapeHtml(color)}</option>`).join("")}
            </select>
          </label>
          <label>Size
            <select name="size">
              ${sizes.map((size) => `<option value="${escapeHtml(size)}">${escapeHtml(size)}</option>`).join("")}
            </select>
          </label>
          <label>Quantity
            <input type="number" name="quantity" value="1" min="1" max="20">
          </label>
          <div class="inline-actions">
            <button class="btn btn-primary" type="submit">Add to Cart</button>
            <a class="btn btn-soft" href="/verify.html">Authenticity Promise</a>
          </div>
        </form>
      </article>
    </div>
  `;

  const hero = mount.querySelector('.product-hero-media img');
  mount.querySelectorAll('[data-gallery-image]').forEach((button) => {
    button.addEventListener('click', () => {
      mount.querySelectorAll('.thumb-btn').forEach((thumb) => thumb.classList.remove('is-active'));
      button.classList.add('is-active');
      if (hero) {
        hero.src = button.dataset.galleryUrl;
        hero.alt = button.dataset.galleryAlt;
      }
    });
  });

  const form = mount.querySelector("[data-add-cart-form]");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const color = form.color.value;
    const size = form.size.value;
    const quantity = Number(form.quantity.value || 1);
    const variant = product.variants.find((entry) => entry.color === color && entry.size === size) || firstVariant;

    addToCart({
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
      currency: "NGN"
    });

    form.reset();
    form.quantity.value = "1";
    alert("Added to cart.");
  });
}

document.addEventListener("DOMContentLoaded", loadProduct);
