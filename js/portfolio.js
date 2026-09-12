/* Native chapter scrolling enhanced with optional controls and keyboard support. */
(() => {
  'use strict';
  const viewer = document.querySelector('#main');
  const chapters = [...viewer.querySelectorAll(':scope > .chapter')];
  const menu = document.querySelector('#site-nav');
  const toggle = document.querySelector('#menu-toggle');
  const previous = document.querySelector('#previous-chapter');
  const next = document.querySelector('#next-chapter');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = matchMedia('(max-width: 600px)');
  const names = ['Home', 'About', 'Experience', 'Projects', 'Skills', 'Education', 'Contact'];
  const links = [...document.querySelectorAll('.site-nav a, .chapter-dots a')];
  let current = 0;
  let settleTimer;
  let resizeFrame;
  let wheelTotal = 0;
  let lastWheel = 0;
  let wheelLockUntil = 0;

  const indexFromHash = () => {
    const index = chapters.findIndex(chapter => '#' + chapter.id === location.hash);
    return index < 0 ? 0 : index;
  };
  const behavior = () => reduced.matches ? 'instant' : 'smooth';
  function closeMenu(focus = false) {
    menu.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open navigation');
    if (focus) toggle.focus();
  }
  function updateControls(index) {
    current = index;
    previous.disabled = index === 0;
    next.disabled = index === chapters.length - 1;
    document.querySelector('#chapter-counter').textContent = String(index + 1).padStart(2, '0') + ' / 07';
    document.querySelector('#chapter-name').textContent = names[index];
    links.forEach(link => {
      if (link.hash === '#' + chapters[index].id) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
  function focusChapter(index) {
    const heading = chapters[index].querySelector('h1, h2');
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
  }
  function goTo(index, { focus = true, history = true, instant = false } = {}) {
    index = Math.max(0, Math.min(chapters.length - 1, index));
    clearTimeout(settleTimer);
    closeMenu();
    const hash = '#' + chapters[index].id;
    if (history && location.hash !== hash) window.history.pushState(null, '', hash);
    updateControls(index);
    chapters[index].scrollTop = 0;
    viewer.scrollTo({ left: index * viewer.clientWidth, behavior: instant ? 'instant' : behavior() });
    if (focus) focusChapter(index);
  }

  toggle.hidden = false;
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    menu.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.classList.contains('is-open')) closeMenu(true);
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('.header-inner')) closeMenu();
  });
  mobile.addEventListener('change', () => closeMenu());

  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', event => {
      // Preserve browser actions such as opening an anchor in another tab.
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      const index = chapters.findIndex(chapter => '#' + chapter.id === link.hash);
      if (index < 0) return;
      event.preventDefault();
      goTo(index);
    });
  });
  previous.addEventListener('click', () => goTo(current - 1));
  next.addEventListener('click', () => goTo(current + 1));
  viewer.addEventListener('keydown', event => {
    const target = event.target;
    const ownsFocus = target === viewer || target.matches('.chapter, h1, h2');
    if (!ownsFocus || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      goTo(current + (event.key === 'ArrowRight' ? 1 : -1));
    }
  });
  // A vertical wheel advances only at the edge of the current chapter.
  // Native vertical reading, horizontal trackpads, touch, and browser zoom stay available.
  viewer.addEventListener('wheel', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY) * .75) return;
    const chapter = chapters[Math.round(viewer.scrollLeft / viewer.clientWidth)] || chapters[current];
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewer.clientHeight : 1);
    const canReadDown = chapter.scrollTop + chapter.clientHeight < chapter.scrollHeight - 2;
    const canReadUp = chapter.scrollTop > 2;
    if ((delta > 0 && canReadDown) || (delta < 0 && canReadUp)) return;
    event.preventDefault();
    const now = performance.now();
    if (now < wheelLockUntil) return;
    if (now - lastWheel > 250 || Math.sign(delta) !== Math.sign(wheelTotal)) wheelTotal = 0;
    wheelTotal += delta;
    lastWheel = now;
    if (Math.abs(wheelTotal) >= 55) {
      goTo(current + Math.sign(wheelTotal), { focus: false });
      wheelTotal = 0;
      wheelLockUntil = now + 650;
    }
  }, { passive: false });

  function onSettled() {
    const index = Math.max(0, Math.min(chapters.length - 1, Math.round(viewer.scrollLeft / viewer.clientWidth)));
    updateControls(index);
    const hash = '#' + chapters[index].id;
    if (location.hash !== hash) window.history.replaceState(null, '', hash);
  }
  viewer.addEventListener('scroll', () => {
    const max = viewer.scrollWidth - viewer.clientWidth;
    document.querySelector('.journey-progress').style.width = (max ? viewer.scrollLeft / max * 100 : 0) + '%';
    clearTimeout(settleTimer);
    settleTimer = setTimeout(onSettled, 140);
  }, { passive: true });
  window.addEventListener('popstate', () => goTo(indexFromHash(), { history: false }));
  window.addEventListener('hashchange', () => goTo(indexFromHash(), { history: false }));
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => viewer.scrollTo({ left: current * viewer.clientWidth, behavior: 'instant' }));
  }, { passive: true });
  reduced.addEventListener('change', () => {
    if (reduced.matches) viewer.scrollTo({ left: current * viewer.clientWidth, behavior: 'instant' });
  });

  const copy = document.querySelector('#copy-email');
  const status = document.querySelector('#contact-status');
  copy.hidden = false;
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(copy.dataset.email);
      status.textContent = 'Email copied. Talk soon.';
    } catch {
      status.textContent = 'You can copy my address: ' + copy.dataset.email;
      const address = document.querySelector('.contact-email');
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(address);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  });
  document.querySelector('#year').textContent = String(new Date().getFullYear());
  document.querySelector('.chapter-controls').hidden = false;
  document.documentElement.classList.add('js');
  goTo(indexFromHash(), { focus: false, history: false, instant: true });
  window.addEventListener('load', () => goTo(indexFromHash(), { focus: false, history: false, instant: true }), { once: true });
})();
