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
  const links = document.querySelector('.nav-links');
  const actions = document.querySelector('.nav-actions');
  if (!nav || !toggle || !links) return;

  const syncDrawerLayout = () => {
    if (window.innerWidth > 900) {
      links.style.removeProperty('--drawer-top');
      links.style.removeProperty('--drawer-height');
      if (actions) actions.style.removeProperty('--drawer-actions-top');
      return;
    }

    const viewport = window.visualViewport;
    const viewportHeight = viewport ? viewport.height : window.innerHeight;
    const headerRect = nav.getBoundingClientRect();
    const topBase = Math.max(headerRect.bottom + 12, 104);
    const actionsHeight = actions ? Math.max(actions.offsetHeight, 56) : 0;
    const linksTop = topBase + actionsHeight + 14;
    const drawerHeight = Math.max(260, viewportHeight - linksTop - 18);

    if (actions) actions.style.setProperty('--drawer-actions-top', `${topBase}px`);
    links.style.setProperty('--drawer-top', `${linksTop}px`);
    links.style.setProperty('--drawer-height', `${drawerHeight}px`);
  };

  const setOpen = (open) => {
    nav.classList.toggle('nav-open', open);
    document.body.classList.toggle('nav-locked', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      syncDrawerLayout();
      requestAnimationFrame(syncDrawerLayout);
    }
  };

  toggle.addEventListener('click', () => {
    setOpen(!nav.classList.contains('nav-open'));
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
    syncDrawerLayout();
  });

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', syncDrawerLayout);
    window.visualViewport.addEventListener('scroll', syncDrawerLayout);
  }

  syncDrawerLayout();
}

document.addEventListener('DOMContentLoaded', () => {
  markCurrentLinks();
  setupMobileNav();
});
