
import { apiGet, escapeHtml, getStorefrontMeta, localizePriceFromUSD } from './api.js';

let allProducts = [];

function productImage(product) {
  if (product.primary_image_url) return `<img src="${product.primary_image_url}" alt="${escapeHtml(product.name)}">`;
  return `<div class="product-image-fallback">${escapeHtml(product.short_code)}</div>`;
}

function stockBadge(product) {
  const stock = Number(product.total_stock || 0);
  if (stock <= 0) return `<span class="pill pill-stock soldout">Sold out</span>`;
  if (stock <= 5) return `<span class="pill pill-stock limited">Only ${stock} left</span>`;
  return `<span class="pill pill-stock in">${stock} available</span>`;
}

function stockMatches(product, filter) {
  const stock = Number(product.total_stock || 0);
  if (!filter) return true;
  if (filter === 'in') return stock > 0;
  if (filter === 'low') return stock > 0 && stock <= 5;
  if (filter === 'out') return stock <= 0;
  return true;
}

function sortProducts(products, sort) {
  const copy = [...products];
  if (sort === 'newest') return copy.sort((a,b) => Number(b.id) - Number(a.id));
  if (sort === 'price_asc') return copy.sort((a,b) => Number(a.price_usd||0) - Number(b.price_usd||0));
  if (sort === 'price_desc') return copy.sort((a,b) => Number(b.price_usd||0) - Number(a.price_usd||0));
  if (sort === 'name_asc') return copy.sort((a,b) => String(a.name||'').localeCompare(String(b.name||'')));
  return copy.sort((a,b) => Number(b.featured||0) - Number(a.featured||0) || Number(a.id)-Number(b.id));
}

async function renderProducts(products) {
  const mount = document.querySelector('[data-shop-products]');
  if (!mount) return;
  if (!products.length) {
    mount.innerHTML = `<div class="empty-state">No products match this filter.</div>`;
    return;
  }
  const cards = await Promise.all(products.map(async (product) => {
    const price = await localizePriceFromUSD(product.price_usd, product.compare_at_usd);
    return `
      <article class="product-card luxury-card interactive-card">
        <div class="product-image has-media">${productImage(product)}</div>
        <div class="product-meta">
          <span class="pill">${escapeHtml(product.category)}</span>
          ${product.collection_label ? `<span class="pill">${escapeHtml(product.collection_label)}</span>` : ''}
          ${stockBadge(product)}
        </div>
        <div>
          <h3>${escapeHtml(product.name)}</h3>
          <p class="muted">${escapeHtml(product.tagline || product.description)}</p>
        </div>
        <div class="price-line">
          <span class="price-main">${price.formatted}</span>
          ${price.formattedCompare ? `<span class="price-compare">${price.formattedCompare}</span>` : ''}
        </div>
        <div class="inline-actions">
          <a class="btn btn-primary" href="/product.html?slug=${encodeURIComponent(product.slug)}">View product</a>
          <a class="btn btn-soft" href="/verify.html">Verify</a>
        </div>
      </article>`;
  }));
  mount.innerHTML = cards.join('');
}

async function applyFilters() {
  const search = (document.querySelector('[data-shop-search]')?.value || '').trim().toLowerCase();
  const category = document.querySelector('[data-shop-category]')?.value || '';
  const stock = document.querySelector('[data-shop-stock]')?.value || '';
  const sort = document.querySelector('[data-shop-sort]')?.value || 'featured';
  const filtered = allProducts.filter((product) => {
    const hay = `${product.name||''} ${product.description||''} ${product.category||''} ${product.collection_label||''}`.toLowerCase();
    return (!search || hay.includes(search)) && (!category || product.category === category) && stockMatches(product, stock);
  });
  await renderProducts(sortProducts(filtered, sort));
}

async function loadShop() {
  const mount = document.querySelector('[data-shop-products]');
  if (!mount) return;
  const [data, meta] = await Promise.all([apiGet('/api/products'), getStorefrontMeta()]);
  allProducts = data.products || [];
  document.querySelectorAll('[data-currency-copy]').forEach((el) => {
    el.textContent = meta.currency === 'NGN' ? '' : `Preview shown in ${meta.currency} for ${meta.country}. Final payment stays in NGN.`;
  });
  const categorySelect = document.querySelector('[data-shop-category]');
  if (categorySelect) {
    const categories = [...new Set(allProducts.map(item => item.category).filter(Boolean))];
    categorySelect.innerHTML = `<option value="">All</option>` + categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('');
  }
  document.querySelectorAll('[data-shop-search], [data-shop-category], [data-shop-stock], [data-shop-sort]').forEach((el) => el?.addEventListener('input', applyFilters));
  document.querySelectorAll('[data-shop-category], [data-shop-stock], [data-shop-sort]').forEach((el) => el?.addEventListener('change', applyFilters));
  await applyFilters();
}

document.addEventListener('DOMContentLoaded', loadShop);
