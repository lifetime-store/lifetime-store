const currentPath = window.location.pathname === '/' ? '/' : window.location.pathname;

function markCurrentLinks() {
  document.querySelectorAll('.nav-links a, .footer-links a').forEach((link) => {
    const href = link.getAttribute('href');
    if (!href) return;
    if (href === '/' && currentPath === '/') link.classList.add('is-current');
    else if (href !== '/' && currentPath.endsWith(href.replace(/^\//, ''))) link.classList.add('is-current');
  });
}

function setupMobileNav() {
  const nav = document.querySelector('.nav');
  const toggle = document.querySelector('.nav-toggle');
  if (!nav || !toggle) return;
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('nav-open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  document.querySelectorAll('.nav-links a, .nav-actions a').forEach((a) => {
    a.addEventListener('click', () => {
      nav.classList.remove('nav-open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  markCurrentLinks();
  setupMobileNav();
});
