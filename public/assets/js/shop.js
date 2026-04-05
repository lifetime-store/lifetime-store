import { apiGet, escapeHtml, formatNGN, formatUSD } from "./api.js";

function productImage(product) {
  if (product.primary_image_url) {
    return `<img src="${product.primary_image_url}" alt="${escapeHtml(product.name)}">`;
  }
  return `<div class="product-image-fallback">${escapeHtml(product.short_code)}</div>`;
}

function stockBadge(product) {
  const stock = Number(product.total_stock || 0);
  if (stock <= 0) return `<span class="pill pill-stock soldout">Sold out</span>`;
  if (stock <= 5) return `<span class="pill pill-stock limited">Only ${stock} left</span>`;
  return `<span class="pill pill-stock in">${stock} available</span>`;
}

async function loadShop() {
  const mount = document.querySelector("[data-shop-products]");
  if (!mount) return;

  const data = await apiGet("/api/products");
  const products = data.products || [];

  if (products.length === 0) {
    mount.innerHTML = `<div class="empty-state">No products available yet. Add your first products from the admin dashboard.</div>`;
    return;
  }

  mount.innerHTML = products.map((product) => `
    <article class="product-card luxury-card">
      <div class="product-image has-media">${productImage(product)}</div>
      <div class="product-meta">
        <span class="pill">${escapeHtml(product.category)}</span>
        <span class="pill">${escapeHtml(product.variant_count)} variant${Number(product.variant_count) === 1 ? "" : "s"}</span>
        ${stockBadge(product)}
      </div>
      <div>
        <h3>${escapeHtml(product.name)}</h3>
        <p class="muted">${escapeHtml(product.description)}</p>
      </div>
      <div class="price-line">
        <span class="price-main">${formatNGN(product.price_ngn)}</span>
        <span class="price-alt">${formatUSD(product.price_usd)}</span>
      </div>
      <div class="inline-actions">
        <a class="btn btn-primary" href="/product.html?slug=${encodeURIComponent(product.slug)}">View Product</a>
      </div>
    </article>
  `).join("");
}

document.addEventListener("DOMContentLoaded", loadShop);
