/**
 * Drives two real browsers through a game and captures screenshots.
 * Useful for reviewing the UI without needing two devices.
 *
 *   npm start &
 *   npx tsx tools/screenshots.ts [outDir]
 */
import { chromium, type Page } from 'playwright';
import { mkdir } from 'node:fs/promises';

const URL = process.env.SHOT_URL ?? 'http://localhost:3000';
const OUT = process.argv[2] ?? 'screenshots';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`  📸 ${name}.png`);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  // Use the pre-installed browser when its version differs from the npm package.
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  });

  const ctxA = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const ctxB = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const host = await ctxA.newPage();
  const guest = await ctxB.newPage();

  const errors: string[] = [];
  for (const [label, page] of [['host', host], ['guest', guest]] as const) {
    page.on('pageerror', (e) => errors.push(`${label}: ${e.message}`));
    page.on('console', (m) => m.type() === 'error' && errors.push(`${label} console: ${m.text()}`));
  }

  console.log('→ Lobby');
  await host.goto(URL);
  await host.fill('input[placeholder="z.B. Ruffy"]', 'Ruffy');
  await wait(400);
  await shot(host, '01-lobby');

  await host.click('button:has-text("Neues Spiel erstellen")');
  await host.waitForSelector('.room-code');
  const code = (await host.textContent('.room-code'))!.trim();
  console.log(`→ Room ${code}`);

  await guest.goto(URL);
  await guest.fill('input[placeholder="z.B. Ruffy"]', 'Zorro');
  await guest.fill('.code-input', code);
  await guest.click('button:has-text("Beitreten")');
  await guest.waitForSelector('.player-slots');
  await wait(500);
  await shot(host, '02-room');

  console.log('→ Starting game');
  await host.click('button:has-text("Spiel starten")');

  // Category banner + pixelated reveal
  await host.waitForSelector('.stage-kicker', { timeout: 15000 });
  await wait(1200);
  await shot(host, '03-category-intro');
  await wait(2600);
  await shot(host, '04-reveal-pixelated');
  await host.waitForSelector('.bidbar', { timeout: 20000 });
  await wait(600);
  await shot(host, '05-auction-open');

  console.log('→ Bidding');
  await host.click('.btn.quick');
  await wait(500);
  await guest.click('.btn.quick');
  await wait(700);
  await shot(host, '06-bidding-war');

  // Let the soft timer expire so the countdown takes over.
  console.log('→ Waiting for countdown');
  await host.waitForSelector('.countdown-number', { timeout: 20000 });
  await wait(400);
  await shot(host, '07-countdown');

  // Sold + board placement
  await host.waitForSelector('.stinger', { timeout: 20000 });
  await wait(400);
  await shot(host, '08-sold');
  await wait(3200);
  await shot(host, '09-board');

  // Mobile view of the same live game
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const phone = await mobile.newPage();
  await phone.goto(URL);
  await phone.fill('input[placeholder="z.B. Ruffy"]', 'Nami');
  await wait(300);
  await shot(phone, '10-mobile-lobby');

  console.log(errors.length ? `\n⚠️  Page errors:\n${errors.join('\n')}` : '\n✓ No page errors');
  await browser.close();
  process.exit(errors.length ? 1 : 0);
}

main().catch(async (err) => {
  console.error('✗ Screenshot run failed:', err.message);
  process.exit(1);
});
