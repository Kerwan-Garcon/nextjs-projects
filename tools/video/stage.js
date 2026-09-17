/*
 * The projector.
 *
 * Every scene's duration comes from `audio/out/<cut>/vo.json` - the narration is
 * recorded first and the picture is cut to it, never the other way round. Edit a
 * line in `audio/script.<cut>.json`, re-run the voice, and the film re-times
 * itself; nobody touches a timeline.
 *
 * A page supplies `window.__CHROME` (the corner labels per scene) and its own
 * scene markup. Everything below is the same for every film.
 */

const CHROME = window.__CHROME ?? {};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Split marked headings into per-word spans so they can be staggered. */
for (const node of document.querySelectorAll('[data-words]')) {
  const tail = node.querySelector('.caret');
  const words = node.childNodes[0].textContent.trim().split(/\s+/);
  node.textContent = '';
  words.forEach((word, index) => {
    const span = document.createElement('span');
    span.className = 'w';
    span.textContent = word;
    span.style.transitionDelay = `${0.06 + index * 0.075}s`;
    node.appendChild(span);
    if (index < words.length - 1) node.appendChild(document.createTextNode(' '));
  });
  if (tail) node.appendChild(tail);
}

/* Count a number up on a strong ease-out, the way a keynote does. */
function countUp(el, target, ms) {
  const t0 = performance.now();
  const ease = (p) => 1 - Math.pow(1 - p, 4);
  const step = (now) => {
    const p = Math.min(1, (now - t0) / ms);
    el.textContent = String(Math.round(target * ease(p)));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

window.__filmReady = false;
window.__filmDone = false;

/* A page knows which cut it is from its own filename, so nothing has to be
 * wired through the recorder to tell it where its narration lives. */
const CUT = location.pathname.replace(/.*\//, '').replace(/\.html$/, '') || 'film';

async function load() {
  const timing = await (await fetch(`audio/out/${CUT}/vo.json`)).json();
  const byId = new Map(timing.lines.map((line) => [line.id, line]));
  const scenes = [...document.querySelectorAll('.scene')].map((el) => ({
    el,
    line: byId.get(el.dataset.line),
  }));

  const missing = scenes.filter((s) => !s.line).map((s) => s.el.dataset.line);
  if (missing.length) throw new Error(`no narration for: ${missing.join(', ')}`);

  window.__filmTotal = timing.totalMs;
  window.__filmReady = true;

  window.__playFilm = async () => {
    const tr = document.getElementById('tr');
    const bl = document.getElementById('bl');
    const wm = document.getElementById('wm');
    const br = document.getElementById('br');
    let previous = null;

    // Absolute schedule, not a chain of relative sleeps. setTimeout only
    // promises "no sooner than", and the DOM work between scenes costs a few
    // milliseconds more, so eleven `await sleep(hold)` calls in a row finish
    // seconds late - which reads as the voice running ahead of the picture.
    const startedAt = performance.now();
    let dueAt = 0;

    for (const { el, line } of scenes) {
      const [top, bottom] = CHROME[el.dataset.line] ?? [null, null];
      tr.textContent = top ?? '';
      bl.textContent = bottom ?? '';
      const bare = el.dataset.line === 'sign';
      wm.classList.toggle('hide', bare);
      br.classList.toggle('hide', bare);

      // Reset entrances so a scene animates every time it is shown.
      el.querySelectorAll('.rise, .w').forEach((node) => {
        node.style.transition = 'none';
        node.style.opacity = '';
        node.style.transform = '';
      });
      void el.offsetWidth;
      el.querySelectorAll('.rise, .w').forEach((node) => { node.style.transition = ''; });

      el.classList.add('on');
      el.querySelectorAll('[data-count]').forEach((node) => {
        node.textContent = '0';
        setTimeout(() => countUp(node, Number(node.dataset.count), 1250), 380);
      });

      // Cross-dissolve: the outgoing scene leaves after the new one is up.
      //
      // The outgoing element is captured by value on purpose. `previous` is
      // reassigned on the next line, and an arrow that closed over the variable
      // would fire 520ms later against whatever it points at by then - which is
      // the scene that just came up. That bug plays as a film where the first
      // shot never leaves and nothing after it stays longer than half a second.
      const outgoing = previous;
      if (outgoing) setTimeout(() => outgoing.classList.remove('on'), 520);
      previous = el;

      dueAt += line.holdMs;
      const remaining = dueAt - (performance.now() - startedAt);
      if (remaining > 0) await sleep(remaining);
    }

    await sleep(400);
    if (previous) previous.classList.remove('on');
    window.__filmDone = true;
  };
}

load().catch((error) => {
  document.body.innerHTML =
    `<pre style="padding:60px;color:#d9534f;font:16px monospace">${error.message}</pre>`;
  window.__filmReady = true;
  window.__filmError = error.message;
});
