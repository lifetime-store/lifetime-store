import { apiGet, escapeHtml, getStorefrontMeta, localizePriceFromUSD } from './api.js';

function productImage(product) {
  if (product.primary_image_url) return `<img src="${product.primary_image_url}" alt="${escapeHtml(product.name)}">`;
  return `<div class="product-image-fallback">${escapeHtml(product.category || product.short_code || 'LT')}</div>`;
}

function stockBadge(product) {
  const stock = Number(product.total_stock || 0);
  if (stock <= 0) return `<span class="pill pill-stock soldout">Sold out</span>`;
  if (stock <= 5) return `<span class="pill pill-stock limited">Only ${stock} left</span>`;
  return `<span class="pill pill-stock in">${stock} in stock</span>`;
}

async function productPriceMarkup(product) {
  const localized = await localizePriceFromUSD(product.price_usd, product.compare_at_usd);
  return `
    <div class="price-line">
      <span class="price-main">${localized.formatted}</span>
      <span class="price-alt">Base ${escapeHtml(localized.country)} region · ${Number(product.price_usd || 0).toFixed(2)} USD</span>
      ${localized.formattedCompare ? `<span class="price-compare">${localized.formattedCompare}</span>` : ''}
    </div>
  `;
}

function setHeroFromMeta(meta) {
  document.querySelectorAll('[data-hero-eyebrow]').forEach((el) => el.textContent = meta.hero_eyebrow || 'Quiet premium essentials');
  document.querySelectorAll('[data-hero-title]').forEach((el) => el.textContent = meta.hero_title || 'Refined essentials built to outlast noise.');
  document.querySelectorAll('[data-hero-copy]').forEach((el) => el.textContent = meta.hero_copy || 'Lifetime builds premium essentials with clean structure and verified authenticity.');
  document.querySelectorAll('[data-hero-cta]').forEach((el) => { el.textContent = meta.hero_cta_label || 'Shop collection'; el.setAttribute('href', meta.hero_cta_href || '/shop.html'); });
}

async function loadFeaturedProducts() {
  const mount = document.querySelector('[data-featured-products]');
  if (!mount) return;

  const [data, meta] = await Promise.all([
    apiGet('/api/products?featured=1'),
    getStorefrontMeta()
  ]);
  const products = data.products || [];

  setHeroFromMeta(meta);
  const spotlight = document.querySelector('[data-region-copy]');
  if (spotlight) { spotlight.textContent = meta.currency === 'NGN' ? '' : `Preview shown in ${meta.currency} for ${meta.country}. Final payment remains in NGN.`; }

  if (!products.length) {
    mount.innerHTML = `<div class="empty-state">No products are live yet. Your first drop will appear here.</div>`;
    return;
  }

  const cards = await Promise.all(products.map(async (product) => `
    <article class="product-card luxury-card interactive-card">
      <div class="product-image has-media">${productImage(product)}</div>
      <div class="product-meta">
        <span class="pill">${escapeHtml(product.category)}</span>
        <span class="pill">${escapeHtml(product.short_code)}</span>
        ${product.collection_label ? `<span class="pill">${escapeHtml(product.collection_label)}</span>` : ''}
        ${stockBadge(product)}
      </div>
      <div>
        <h3>${escapeHtml(product.name)}</h3>
        <p class="muted">${escapeHtml(product.tagline || product.description)}</p>
      </div>
      ${await productPriceMarkup(product)}
      <div class="inline-actions">
        <a class="btn btn-primary" href="/product.html?slug=${encodeURIComponent(product.slug)}">View Product</a>
        <a class="btn btn-soft" href="/verify.html">Verify Item</a>
      </div>
    </article>
  `));

  mount.innerHTML = cards.join('');
}

document.addEventListener('DOMContentLoaded', loadFeaturedProducts);
