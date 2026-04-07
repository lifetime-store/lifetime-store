
import { getStorefrontMeta } from './api.js';

document.addEventListener('DOMContentLoaded', async () => {
  const meta = await getStorefrontMeta();
  document.querySelectorAll('[data-policy]').forEach((el) => {
    const key = el.getAttribute('data-policy');
    el.innerHTML = meta[key] || '<p class="muted">Content not set yet.</p>';
  });
});
