import { chromium } from 'playwright';
const MEDIA = '/cursor/stores/bc-01a15d47-c307-7695-9eec-74a83f124e25/media';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.locator('input[type="email"]').first().fill('cloud@thrft.local');
await page.locator('input[type="password"]').first().fill('cloud-cloud-cloud');
await page.getByRole('button', { name: /sign in/i }).click();
await page.waitForSelector('nav.tab-bar', { timeout: 25000 });
await page.getByRole('button', { name: 'Create', exact: true }).click();
await page.waitForTimeout(300);
await page.getByRole('tab', { name: 'Store' }).click();
await page.waitForTimeout(200);
await page.locator('.listing-globe-trigger').first().click();
await page.waitForSelector('.brand-globe-stage', { timeout: 8000 });
await page.waitForTimeout(400);

async function sample(n, dt, during) {
  const samples = [];
  for (let i = 0; i < n; i++) {
    if (during) await during(i);
    samples.push(await page.evaluate(() => {
      const labels = [...document.querySelectorAll('.brand-globe-label')];
      return {
        n: labels.length,
        // Visible enough to read
        ids: labels.filter(el => +getComputedStyle(el).opacity > 0.15).map(el => el.getAttribute('data-brand-id')),
        mounted: labels.map(el => el.getAttribute('data-brand-id')),
      };
    }));
    await page.waitForTimeout(dt);
  }
  return samples;
}

function shortBlinks(samples, key = 'ids') {
  const allIds = new Set(samples.flatMap(s => s[key]));
  const blinks = [];
  for (const id of allIds) {
    const seq = samples.map(s => (s[key].includes(id) ? 1 : 0));
    let i = 0;
    while (i < seq.length) {
      while (i < seq.length && seq[i] === 1) i++;
      if (i >= seq.length) break;
      const start = i;
      while (i < seq.length && seq[i] === 0) i++;
      const dur = i - start;
      const hadBefore = start > 0 && seq[start - 1] === 1;
      const hasAfter = i < seq.length && seq[i] === 1;
      if (hadBefore && hasAfter && dur > 0 && dur <= 25) {
        blinks.push({ id, start, dur });
      }
    }
  }
  return blinks;
}

const idle = await sample(45, 70);
await page.screenshot({ path: `${MEDIA}/thrft_brand_globe_no_blink_idle.png` });

const stage = page.locator('.brand-globe-stage');
const box = await stage.boundingBox();
await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.45);
await page.mouse.down();
const drag = await sample(40, 40, async (i) => {
  await page.mouse.move(
    box.x + box.width * 0.75 - i * 6,
    box.y + box.height * 0.45 + Math.sin(i / 4) * 12,
  );
});
await page.mouse.up();
await page.waitForTimeout(200);
await page.screenshot({ path: `${MEDIA}/thrft_brand_globe_no_blink_drag.png` });
const coast = await sample(30, 60);

const result = {
  idleVisibleBlinks: shortBlinks(idle, 'ids'),
  idleMountBlinks: shortBlinks(idle, 'mounted'),
  dragVisibleBlinks: shortBlinks(drag, 'ids'),
  dragMountBlinks: shortBlinks(drag, 'mounted'),
  coastVisibleBlinks: shortBlinks(coast, 'ids'),
  coastMountBlinks: shortBlinks(coast, 'mounted'),
  idleRange: [Math.min(...idle.map(s=>s.n)), Math.max(...idle.map(s=>s.n))],
  dragRange: [Math.min(...drag.map(s=>s.n)), Math.max(...drag.map(s=>s.n))],
};
// Pass if no short mount blinks (DOM) and no short visible blinks on idle/coast.
// Drag may briefly dim at limb; mount blinks are the real bug.
result.pass =
  result.idleVisibleBlinks.length === 0 &&
  result.idleMountBlinks.length === 0 &&
  result.dragMountBlinks.length === 0 &&
  result.coastMountBlinks.length === 0 &&
  result.coastVisibleBlinks.length === 0;
console.log(JSON.stringify(result, null, 2));
await browser.close();
if (!result.pass) process.exit(1);
