const menuButton = document.querySelector('[data-menu-toggle]');
const mainNav = document.querySelector('[data-main-nav]');

if (menuButton && mainNav) {
  const closeMenu = () => {
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'باز کردن منو');
    mainNav.classList.remove('is-open');
  };

  menuButton.addEventListener('click', () => {
    const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!isOpen));
    menuButton.setAttribute('aria-label', isOpen ? 'باز کردن منو' : 'بستن منو');
    mainNav.classList.toggle('is-open', !isOpen);
  });

  mainNav.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
  window.addEventListener('resize', () => {
    if (window.innerWidth > 860) closeMenu();
  });
}

const cooperationDialog = document.querySelector('[data-cooperation-dialog]');
const cooperationButton = document.querySelector('[data-open-cooperation]');

if (cooperationDialog && cooperationButton) {
  cooperationButton.addEventListener('click', () => {
    if (typeof cooperationDialog.showModal === 'function') cooperationDialog.showModal();
  });
}

const reviewTrack = document.querySelector('[data-review-track]');
const reviewViewport = document.querySelector('[data-review-slider]');
const reviewPrev = document.querySelector('[data-review-prev]');
const reviewNext = document.querySelector('[data-review-next]');

if (reviewTrack && reviewViewport) {
  const scrollStep = () => Math.max(reviewViewport.clientWidth * 0.78, 260);
  const scrollOptions = () => ({ left: scrollStep(), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });

  reviewPrev?.addEventListener('click', () => {
    reviewViewport.scrollBy({ ...scrollOptions(), left: -scrollStep() });
  });

  reviewNext?.addEventListener('click', () => {
    reviewViewport.scrollBy(scrollOptions());
  });

  // چرخش خودکار فقط وقتی فعال می‌شود که کارت‌های واقعی و تأییدشده اضافه شوند.
  // برای فعال‌سازی هر نظر واقعی، data-review-ready="true" را فقط پس از گرفتن اجازه انتشار قرار دهید.
  const approvedReviews = reviewTrack.querySelectorAll('[data-review-ready="true"]');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (approvedReviews.length > 1 && !reducedMotion) {
    let timer;
    const startRotation = () => {
      window.clearInterval(timer);
      timer = window.setInterval(() => {
        const atEnd = reviewViewport.scrollLeft >= reviewTrack.scrollWidth - reviewViewport.clientWidth - 8;
        reviewViewport.scrollTo({ left: atEnd ? 0 : reviewViewport.scrollLeft + scrollStep(), behavior: 'smooth' });
      }, 5200);
    };
    const stopRotation = () => window.clearInterval(timer);

    reviewViewport.addEventListener('mouseenter', stopRotation);
    reviewViewport.addEventListener('mouseleave', startRotation);
    reviewViewport.addEventListener('focusin', stopRotation);
    reviewViewport.addEventListener('focusout', startRotation);
    startRotation();
  }
}

const year = document.querySelector('[data-current-year]');
if (year) year.textContent = String(new Date().getFullYear());
