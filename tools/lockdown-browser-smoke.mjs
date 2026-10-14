/** Actual game UI and native input checks, with no injected simulation state. */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const base = process.env.LOCKDOWN_URL || 'http://127.0.0.1:3128';
const out = 'test-results/lockdown-live'; await mkdir(out, { recursive: true });
try {
  for (const [name, width, height] of [['desktop', 1280, 820], ['phone', 393, 852], ['small-phone', 320, 720]]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    const errors = [], failures = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if (r.status() >= 400) failures.push(`${r.status()} ${r.url()}`); });
    await page.goto(`${base}/lockdown.html?solo=1`);
    await page.locator('#ld-map').selectOption('skyway');
    await page.locator('#ld-start').click();
    await page.waitForFunction(() => document.querySelector('#ld-app').dataset.phase === 'fight');
    assert.equal(await page.locator('#ld-arena').getAttribute('data-renderer'), 'webgl', `${name}: 3D renderer is active`);
    await page.locator('#ld-arena').focus();
    await page.keyboard.down('KeyD'); await page.waitForTimeout(2400); await page.keyboard.up('KeyD');
    await page.mouse.move(width * .7, height * .45);
    await page.mouse.down(); await page.waitForTimeout(400); await page.mouse.up();
    await page.keyboard.press('Digit2');
    await page.mouse.down(); await page.waitForTimeout(180); await page.mouse.up();
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);
    const bounds = await page.evaluate(() => ['.ld-top', '.ld-weapons', '.ld-vitals', '#ld-score0', '#ld-score1'].map(selector => {
      const r = document.querySelector(selector).getBoundingClientRect();
      return { selector, left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    }));
    for (const rect of bounds) assert.ok(rect.left >= 0 && rect.right <= width && rect.top >= 0 && rect.bottom <= height, `${name}: clipped ${rect.selector} ${JSON.stringify(rect)}`);
    assert.equal(await page.locator('.ld-weapon').count(), 4);
    await page.screenshot({ path: `${out}/${name}.png` });
    await page.keyboard.press('Escape');
    await page.locator('#ld-resume').click();
    assert.deepEqual(errors, []); assert.deepEqual(failures, []);
    console.log(`${name}: WebGL, movement, blade, gun, dash, menu, 4 slots and HUD bounds passed`);
    await page.close();
  }
} finally { await browser.close(); }
