/* A small, user-triggered sketch animation. The SVG is useful without JavaScript. */
(() => {
  'use strict';
  const scene = document.querySelector('.stadium-scene');
  const button = document.querySelector('#stadium-kick');
  const status = document.querySelector('#stadium-status');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let goalTimer;
  let clearTimer;
  let playing = false;
  let goals = 0;
  function finish() {
    clearTimeout(goalTimer);
    scene.classList.remove('is-kicking');
    scene.classList.add('is-goal');
    playing = false;
    button.disabled = false;
    status.textContent = 'Goal! Forza Inter. ' + (++goals) + (goals === 1 ? ' goal.' : ' goals.');
    clearTimeout(clearTimer);
    clearTimer = setTimeout(() => scene.classList.remove('is-goal'), 1600);
  }
  button.addEventListener('click', () => {
    if (playing) return;
    clearTimeout(clearTimer);
    scene.classList.remove('is-goal');
    if (reduced.matches) { finish(); return; }
    playing = true;
    button.disabled = true;
    const width = scene.clientWidth, height = scene.clientHeight;
    scene.style.setProperty('--kick-x', (-width * .12) + 'px');
    scene.style.setProperty('--kick-y', (-height * .36) + 'px');
    scene.style.setProperty('--kick-apex', (-height * .52) + 'px');
    status.textContent = 'Taking a shot…';
    scene.classList.add('is-kicking');
    goalTimer = setTimeout(finish, 1000);
  });
  reduced.addEventListener('change', () => { if (reduced.matches && playing) finish(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && playing) finish(); });
  document.querySelector('#stadium-controls').hidden = false;
})();
