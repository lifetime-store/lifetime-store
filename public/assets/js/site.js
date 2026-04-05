
import { apiGet, escapeHtml, formatNGN, formatUSD } from "./api.js";

async function loadFeaturedProducts() {
  const mount = document.querySelector("[data-featured-products]");
  if (!mount) return;

  const data = await apiGet("/api/products?featured=1");
  const products = data.products || [];

  if (products.length === 0) {
    mount.innerHTML = `<div class="empty-state">No products are live yet. Your first drop will appear here.</div>`;
    return;
  }

  mount.innerHTML = products.map((product) => `
    <article class="product-card">
      <div class="product-image">${escapeHtml(product.category)}</div>
      <div class="product-meta">
        <span class="pill">${escapeHtml(product.category)}</span>
        <span class="pill">${escapeHtml(product.short_code)}</span>
      </div>
      <div>
        <h3>${escapeHtml(product.name)}</h3>
        <p class="muted">${escapeHtml(product.tagline || product.description)}</p>
      </div>
      <div class="price-line">
        <span class="price-main">${formatNGN(product.price_ngn)}</span>
        <span class="price-alt">${formatUSD(product.price_usd)}</span>
      </div>
      <div class="inline-actions">
        <a class="btn btn-primary" href="/product.html?slug=${encodeURIComponent(product.slug)}">View Product</a>
        <a class="btn btn-soft" href="/verify.html">Verify Item</a>
      </div>
    </article>
  `).join("");
}

document.addEventListener("DOMContentLoaded", loadFeaturedProducts);
