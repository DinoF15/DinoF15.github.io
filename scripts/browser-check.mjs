import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, '.preview');
await mkdir(output, { recursive: true });
await mkdir(resolve(root, 'assets'), { recursive: true });
const browser = process.env.CHROME_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
].find(existsSync);
if (!browser) throw new Error('Set CHROME_PATH to a Chrome or Chromium executable.');
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:4173';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const portServer = createServer();
await new Promise(resolve => portServer.listen(0, '127.0.0.1', resolve));
const port = portServer.address().port;
await new Promise(resolve => portServer.close(resolve));
let server;
try { await fetch(base); } catch {
  server = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: root, windowsHide: true, stdio: 'ignore' });
}
const chrome = spawn(browser, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--disable-background-networking', '--disable-extensions',
  '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=' + port,
  '--user-data-dir=' + resolve(output, 'chrome-profile'), 'about:blank'
], { windowsHide: true, stdio: 'ignore' });
const errors = [];
chrome.on('error', error => errors.push(error.message));
let socket;
try {
  let target;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const targets = await (await fetch('http://127.0.0.1:' + port + '/json')).json();
      target = targets.find(item => item.type === 'page');
      if (target && (await fetch(base)).ok) break;
    } catch {}
    await sleep(100);
  }
  if (!target) throw new Error('Browser did not start. ' + errors.join('; '));
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let nextId = 0;
  const pending = new Map();
  const runtimeErrors = [];
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const task = pending.get(message.id);
      pending.delete(message.id);
      clearTimeout(task.timer);
      if (message.error) task.reject(new Error(JSON.stringify(message.error)));
      else task.resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown') runtimeErrors.push(message.params.exceptionDetails.text + ': ' + (message.params.exceptionDetails.exception?.description || ''));
  });
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('CDP timeout: ' + method)); }, 20000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const navigate = async (hash = '') => {
    await call('Page.navigate', { url: base + hash });
    await sleep(150);
    for (let i = 0; i < 60; i++) {
      if (await evaluate('document.readyState === "complete" && Boolean(document.querySelector("#main .chapter"))')) break;
      await sleep(100);
    }
    await sleep(250);
  };
  const screenshot = async (name, full = false) => {
    const metrics = await call('Page.getLayoutMetrics');
    const clip = full ? { x: 0, y: 0, width: metrics.cssContentSize.width, height: metrics.cssContentSize.height, scale: 1 } : undefined;
    const result = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: full, ...(clip ? { clip } : {}) });
    await writeFile(resolve(output, name), Buffer.from(result.data, 'base64'));
  };
  const waitFor = async (expression, message) => {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (await evaluate(expression)) return;
      await sleep(50);
    }
    assert.fail(message);
  };
  const chapters = ['home', 'about', 'experience', 'projects', 'skills', 'education', 'contact'];
  const expectChapter = async (id, focused = false) => {
    await waitFor(`(() => {
      const viewer = document.querySelector('#main');
      const chapter = document.getElementById(${JSON.stringify(id)});
      return (location.hash === '#${id}' || (${JSON.stringify(id)} === 'home' && !location.hash)) &&
        Math.abs(chapter.getBoundingClientRect().left - viewer.getBoundingClientRect().left) < 3;
    })()`, 'Chapter did not come into view: ' + id);
    const count = String(chapters.indexOf(id) + 1).padStart(2, '0');
    await waitFor(`document.querySelector('#chapter-counter').textContent.replace(/\\s/g, '') === '${count}/07'`, 'Incorrect chapter counter for ' + id);
    if (focused) assert.equal(await evaluate('document.activeElement.id'), id === 'home' ? 'hero-title' : id + '-title', 'Chapter navigation should focus its heading');
  };
  const goTo = async id => {
    await evaluate(`document.querySelector('.chapter-dots a[href="#${id}"]').click()`);
    await expectChapter(id, true);
  };
  const key = async (key, code = key) => {
    await call('Input.dispatchKeyEvent', { type: 'keyDown', key, code });
    await call('Input.dispatchKeyEvent', { type: 'keyUp', key, code });
  };
  await call('Page.enable');
  await call('Runtime.enable');
  await call('Emulation.setFocusEmulationEnabled', { enabled: true });
  await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await navigate();
  assert.equal(await evaluate('document.querySelectorAll("h1").length'), 1);
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, 'Desktop overflow');
  assert.deepEqual(await evaluate('[...document.querySelectorAll("#main > .chapter")].map(section => section.id)'), chapters);
  await expectChapter('home');
  assert.equal(await evaluate('document.querySelector("#previous-chapter").disabled'), true, 'Previous control should be disabled at the first chapter');
  assert.equal(await evaluate('document.querySelector("#stadium-controls").hidden'), false, 'Stadium controls not initialized');
  assert.equal(await evaluate('(() => { const image = document.querySelector(".stadium-scene img"); return image.complete && image.naturalWidth > 0 && image.getAttribute("src").endsWith("stadium-sketch.svg"); })()'), true, 'SVG stadium must load');
  await screenshot('desktop.png');
  await evaluate('document.querySelector("#stadium-kick").click()');
  await waitFor('/goal/i.test(document.querySelector("#stadium-status").textContent)', 'Kick should announce a goal');
  await evaluate('document.querySelector("#next-chapter").click()');
  await expectChapter('about', true);
  await evaluate('document.querySelector("#previous-chapter").click()');
  await expectChapter('home', true);
  await evaluate('document.querySelector("#main").focus()');
  await key('ArrowRight');
  await expectChapter('about', true);
  await key('ArrowLeft');
  await expectChapter('home', true);
  const wheelPoint = await evaluate('(() => { const chapter = document.querySelector("#home"); chapter.scrollTop = chapter.scrollHeight; const r = chapter.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + Math.min(r.height / 2, 180)) }; })()');
  await sleep(700);
  await call('Input.dispatchMouseEvent', { type: 'mouseWheel', ...wheelPoint, deltaX: 0, deltaY: 800 });
  await expectChapter('about');
  for (const id of ['about', 'experience', 'projects', 'skills', 'contact']) {
    await goTo('home');
    await evaluate('document.querySelector(".stadium-hotspot[data-zone=' + id + ']").click()');
    await expectChapter(id, true);
  }
  assert.equal(await evaluate('document.querySelector("#next-chapter").disabled'), true, 'Next control should be disabled at the last chapter');
  await navigate('#projects');
  await expectChapter('projects');
  await goTo('skills');
  await evaluate('history.back()');
  await expectChapter('projects');
  await evaluate('history.forward()');
  await expectChapter('skills');
  await goTo('contact');
  await call('Browser.grantPermissions', { origin: base, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] });
  await evaluate('document.querySelector("#copy-email").click()');
  await sleep(150);
  assert.match(await evaluate('document.querySelector("#contact-status").textContent'), /copied/i);
  assert.equal(await evaluate('navigator.clipboard.readText()'), 'fejzulovic231@gmail.com');
  for (const width of [320, 390, 600, 768, 1024]) {
    await call('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: width < 600 });
    await goTo('home');
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, 'Overflow at ' + width);
    for (const id of chapters) {
      await goTo(id);
      const dimensions = await evaluate(`(() => {
        const chapter = document.getElementById('${id}');
        chapter.scrollTop = chapter.scrollHeight;
        return { width: chapter.clientWidth, contentWidth: chapter.scrollWidth,
          bottomReached: Math.abs(chapter.scrollHeight - chapter.clientHeight - chapter.scrollTop) < 3 };
      })()`);
      assert.ok(dimensions.contentWidth <= dimensions.width + 1, id + ' content overflows horizontally at ' + width);
      assert.equal(dimensions.bottomReached, true, id + ' content must be reachable at ' + width);
    }
    if (width === 390) {
      await goTo('home');
      await evaluate('document.querySelector("#home").scrollTop = 0');
      await screenshot('mobile.png');
      await evaluate('document.querySelector("#menu-toggle").click()');
      assert.equal(await evaluate('document.querySelector("#menu-toggle").getAttribute("aria-expanded")'), 'true');
      await key('Escape');
      assert.equal(await evaluate('document.querySelector("#menu-toggle").getAttribute("aria-expanded")'), 'false');
      assert.equal(await evaluate('document.activeElement.id'), 'menu-toggle');
      await evaluate('document.querySelector("#menu-toggle").click(); document.querySelector("#site-nav a[href$=skills]").click()');
      assert.equal(await evaluate('document.querySelector("#menu-toggle").getAttribute("aria-expanded")'), 'false');
      await expectChapter('skills', true);
      await goTo('experience');
      await screenshot('mobile-experience.png');
      await goTo('home');
      await evaluate('document.querySelector("#home").scrollTop = 0');
      await call('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
      const touchY = await evaluate('Math.round(document.querySelector("#main").getBoundingClientRect().top + 80)');
      await call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 340, y: touchY }] });
      for (const x of [290, 230, 170, 110, 60]) {
        await call('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: touchY }] });
        await sleep(30);
      }
      await call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await expectChapter('about');
      await call('Emulation.setTouchEmulationEnabled', { enabled: false });
    }
  }
  await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await navigate();
  assert.equal(await evaluate('getComputedStyle(document.querySelector("#main")).scrollBehavior'), 'auto');
  await evaluate('document.querySelector("#stadium-kick").click()');
  assert.match(await evaluate('document.querySelector("#stadium-status").textContent'), /goal/i, 'Reduced motion should announce a goal without waiting for animation');
  await goTo('education');
  await call('Emulation.setDeviceMetricsOverride', { width: 1200, height: 630, deviceScaleFactor: 1, mobile: false });
  await navigate();
  const social = await call('Page.captureScreenshot', { format: 'png' });
  await writeFile(resolve(root, 'img/social-preview.png'), Buffer.from(social.data, 'base64'));
  await navigate();
  await call('Emulation.setEmulatedMedia', { media: 'print', features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  assert.equal(await evaluate('["home", "experience", "projects", "skills", "education"].every(id => { const chapter = document.getElementById(id); return getComputedStyle(chapter).display !== "none" && chapter.getBoundingClientRect().width > 0; })'), true, 'Print must include every resume chapter');
  const pdf = await call('Page.printToPDF', { printBackground: false, preferCSSPageSize: true, displayHeaderFooter: false, generateTaggedPDF: true });
  await writeFile(resolve(root, 'assets/Dino-Fejzulovic-Resume.pdf'), Buffer.from(pdf.data, 'base64'));
  await screenshot('print-layout.png', true);
  await call('Emulation.setEmulatedMedia', { media: '', features: [] });
  await call('Emulation.setScriptExecutionDisabled', { value: true });
  await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await navigate();
  assert.equal(await evaluate('getComputedStyle(document.querySelector("#site-nav")).display !== "none"'), true, 'No-JS navigation must remain visible');
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, 'No-JS mobile overflow');
  assert.equal(await evaluate('document.documentElement.classList.contains("js")'), false);
  assert.equal(await evaluate('(() => { const sections = [...document.querySelectorAll("#main > .chapter")]; return sections.every((section, index) => getComputedStyle(section).display !== "none" && (index === 0 || section.getBoundingClientRect().top >= sections[index - 1].getBoundingClientRect().bottom - 1)); })()'), true, 'No-JS chapters must be visible and stacked vertically');
  await screenshot('no-javascript.png');
  assert.deepEqual(runtimeErrors, [], 'Browser JavaScript errors');
  assert.equal((await fetch(base + '/assets/Dino-Fejzulovic-Resume.pdf')).status, 200);
  assert.equal((await fetch(base + '/img/social-preview.png')).status, 200);
  console.log('PASS: desktop + 5 responsive widths, horizontal chapters, next/previous, keyboard/wheel, deep links/history, SVG stadium/kick, heading focus, clipboard, mobile menu, reduced motion, stacked no-JS fallback, PDF + social image.');
  console.log('Preview screenshots: .preview/ | Resume: assets/Dino-Fejzulovic-Resume.pdf');
} finally {
  if (socket) socket.close();
  chrome.kill();
  if (server) server.kill();
}
