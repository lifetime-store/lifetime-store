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

  const navLinks = nav.querySelector('.nav-links');
  const navActions = nav.querySelector('.nav-actions');

  const setOpen = (open) => {
    nav.classList.toggle('nav-open', open);
    document.body.classList.toggle('nav-locked', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (navLinks) navLinks.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (navActions) navActions.setAttribute('aria-hidden', open ? 'false' : 'true');
  };

  setOpen(false);

  toggle.addEventListener('click', () => {
    const next = !nav.classList.contains('nav-open');
    setOpen(next);
    if (next && navLinks) {
      const firstLink = navLinks.querySelector('a');
      if (firstLink) firstLink.focus({ preventScroll: true });
    }
  });

  document.querySelectorAll('.nav-links a, .nav-actions a').forEach((a) => {
    a.addEventListener('click', () => setOpen(false));
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setOpen(false);
  });

  document.addEventListener('click', (event) => {
    if (!nav.classList.contains('nav-open')) return;
    if (nav.contains(event.target)) return;
    setOpen(false);
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 900) setOpen(false);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  markCurrentLinks();
  setupMobileNav();
});
