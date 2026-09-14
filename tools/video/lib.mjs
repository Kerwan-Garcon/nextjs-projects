/** Shared helpers for the recorded walkthroughs. */

import { chromium } from '@playwright/test';

/**
 * Launch the browser used for every recording.
 *
 * `PLAYWRIGHT_CHROMIUM_PATH` wins when set - some sandboxes ship a Chromium
 * whose build number does not match what Playwright expects to find. Otherwise
 * Playwright resolves its own.
 */
export function launch() {
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;
  return chromium.launch({
    ...(executablePath ? { executablePath } : {}),
    args: ['--force-device-scale-factor=1', '--hide-scrollbars'],
  });
}

/** Recording geometry. 16:9 in, 1080p out, no resampling of the aspect. */
export const FRAME = { width: 1600, height: 900 };


/**
 * A visible cursor. Playwright drives real mouse events but renders no pointer,
 * so a recording of a click looks like the page changing by itself. This draws
 * a pointer that follows the events we actually dispatch.
 */
export const CURSOR = `
  (() => {
    if (window.__cursorInstalled) return;
    window.__cursorInstalled = true;
    const install = () => {
      const dot = document.createElement('div');
      dot.id = '__cursor';
      dot.style.cssText = [
        'position:fixed', 'z-index:2147483647', 'pointer-events:none',
        'width:18px', 'height:18px', 'margin:-9px 0 0 -9px', 'border-radius:50%',
        'border:1.5px solid rgba(255,255,255,.92)',
        'background:rgba(255,255,255,.14)',
        'box-shadow:0 0 0 1px rgba(0,0,0,.55), 0 2px 10px rgba(0,0,0,.5)',
        'transition:transform .09s ease-out', 'left:-100px', 'top:-100px',
      ].join(';');
      document.documentElement.appendChild(dot);

      addEventListener('mousemove', (e) => {
        dot.style.left = e.clientX + 'px';
        dot.style.top = e.clientY + 'px';
      }, true);

      addEventListener('mousedown', () => {
        dot.style.transform = 'scale(.55)';
        dot.style.background = 'rgba(120,200,255,.55)';
        const ring = document.createElement('div');
        ring.style.cssText = [
          'position:fixed','z-index:2147483646','pointer-events:none',
          'left:' + dot.style.left, 'top:' + dot.style.top,
          'width:16px','height:16px','margin:-8px 0 0 -8px','border-radius:50%',
          'border:2px solid rgba(120,200,255,.9)',
        ].join(';');
        ring.animate(
          [{ transform: 'scale(1)', opacity: 0.9 }, { transform: 'scale(3.4)', opacity: 0 }],
          { duration: 420, easing: 'ease-out' },
        );
        document.documentElement.appendChild(ring);
        setTimeout(() => ring.remove(), 440);
      }, true);

      addEventListener('mouseup', () => {
        dot.style.transform = 'scale(1)';
        dot.style.background = 'rgba(255,255,255,.14)';
      }, true);
    };
    if (document.readyState === 'loading') addEventListener('DOMContentLoaded', install);
    else install();
  })();
`;

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The app has a sticky header; anything under it cannot be clicked. */
const HEADER_SAFE_PX = 150;

/** Move the pointer in small steps so the recording shows the travel. */
export async function moveTo(page, target, { steps = 26, timeout = 15_000 } = {}) {
  await target.waitFor({ state: 'visible', timeout });
  const box = await target.boundingBox();
  if (!box) return null;
  const x = box.x + box.width / 2;
  const y = box.y + Math.min(box.height / 2, 24);
  await page.mouse.move(x, y, { steps });
  return { x, y };
}

/**
 * Click the way a person does, and make sure it lands.
 *
 * Driving the mouse by coordinate is what makes a recording legible - you see
 * the pointer travel and the button depress - but unlike `locator.click()` it
 * checks nothing. It does not wait for the element, it does not scroll it clear
 * of the sticky header, and it does not notice when something else is on top of
 * the point it is about to press. Each of those produced a walkthrough that
 * carried on confidently against a page where nothing had happened.
 *
 * So: wait, scroll clear, then ask the page what is actually under the cursor
 * before pressing. If it is not the thing we meant, fall back to a real locator
 * click rather than record a lie.
 */
export async function clickOn(page, target, { settle = 700, timeout = 15_000 } = {}) {
  await target.waitFor({ state: 'visible', timeout });
  await target.scrollIntoViewIfNeeded().catch(() => {});
  await sleep(240);

  // Keep the target out from under the sticky header.
  const box = await target.boundingBox();
  if (box && box.y < HEADER_SAFE_PX) {
    await page.evaluate((dy) => window.scrollBy(0, dy), box.y - HEADER_SAFE_PX);
    await sleep(320);
  }

  const at = await moveTo(page, target, { timeout });
  if (!at) {
    await target.click({ timeout });
    await sleep(settle);
    return;
  }

  const willHit = await target.evaluate(
    (node, point) => {
      const top = document.elementFromPoint(point.x, point.y);
      return Boolean(top) && (node === top || node.contains(top) || top.contains(node));
    },
    at,
  );

  if (!willHit) {
    // Something is over the point. Let Playwright do it properly.
    await target.click({ timeout });
    await sleep(settle);
    return;
  }

  await sleep(260);
  await page.mouse.down();
  await sleep(70);
  await page.mouse.up();
  await sleep(settle);
}

/**
 * Scroll the way a person reads: continuously, at a readable rate, rather than
 * jumping. `px` is the total distance, `ms` the time it should take.
 */
export async function glide(page, px, ms = 2200) {
  await page.evaluate(
    ([distance, duration]) =>
      new Promise((resolve) => {
        const start = window.scrollY;
        const t0 = performance.now();
        const ease = (p) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);
        const step = (now) => {
          const p = Math.min(1, (now - t0) / duration);
          window.scrollTo(0, start + distance * ease(p));
          if (p < 1) requestAnimationFrame(step);
          else resolve();
        };
        requestAnimationFrame(step);
      }),
    [px, ms],
  );
}

export async function toTop(page, ms = 600) {
  const y = await page.evaluate(() => window.scrollY);
  if (y > 0) await glide(page, -y, ms);
}

/** Timeline recorder: captions are generated from when beats actually fired. */
export function timeline(startedAt) {
  const beats = [];
  return {
    beats,
    at: (text, { kind = 'caption' } = {}) => {
      beats.push({ t: Date.now() - startedAt, text, kind });
      const s = ((Date.now() - startedAt) / 1000).toFixed(1);
      console.log(`  ${s.padStart(6)}s  ${text}`);
    },
  };
}

const ASS_HEADER = (w, h) => `[Script Info]
ScriptType: v4.00+
PlayResX: ${w}
PlayResY: ${h}
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,DejaVu Sans,40,&H00F2F5F7,&H00FFFFFF,&H00101318,&HB4000000,0,0,0,0,100,100,0.6,0,3,14,0,2,90,90,58,1
Style: Label,DejaVu Sans Mono,27,&H00A8E0FF,&H00FFFFFF,&H00101318,&HC8000000,0,0,0,0,100,100,2.2,0,3,12,0,7,72,72,64,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

const stamp = (ms) => {
  const cs = Math.round(ms / 10);
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`;
};

/** Build an ASS track from the beats, each caption lasting until the next. */
export function toAss(beats, totalMs, { width = 1920, height = 1080, offsetMs = 0 } = {}) {
  const lines = [ASS_HEADER(width, height)];
  beats.forEach((beat, index) => {
    const start = Math.max(0, beat.t + offsetMs);
    const end = Math.min(totalMs, (beats[index + 1]?.t ?? totalMs) + offsetMs - 120);
    if (end <= start + 200) return;
    const style = beat.kind === 'label' ? 'Label' : 'Caption';
    const text = beat.text.replace(/\n/g, '\\N');
    lines.push(
      `Dialogue: 0,${stamp(start)},${stamp(end)},${style},,0,0,0,,{\\fad(180,180)}${text}`,
    );
  });
  return lines.join('\n');
}
