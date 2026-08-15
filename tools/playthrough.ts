/**
 * Drives two real browsers through an ENTIRE game (all 10 categories, trading
 * phases and the final reveal) and screenshots the important moments.
 *
 *   npm start &
 *   npx tsx tools/playthrough.ts [outDir]
 */
import { chromium, type Page } from 'playwright';
import { mkdir } from 'node:fs/promises';

const URL = process.env.SHOT_URL ?? 'http://localhost:3000';
const OUT = process.argv[2] ?? 'screenshots';
const CHROME = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`  📸 ${name}.png`);
}

/** Clicks a selector if it is present and enabled; never throws. */
async function tryClick(page: Page, selector: string): Promise<boolean> {
  try {
    const el = page.locator(selector).first();
    if ((await el.count()) === 0) return false;
    if (!(await el.isEnabled({ timeout: 300 }))) return false;
    await el.click({ timeout: 800 });
    return true;
  } catch {
    return false;
  }
}

async function phaseOf(page: Page): Promise<string> {
  return page.evaluate(() => {
    if (document.querySelector('.reveal')) return document.querySelector('.winner-banner') ? 'game_over' : 'final_reveal';
    if (document.querySelector('.trading-shell')) return 'trading';
    if (document.querySelector('.lastpick')) return 'last_pick';
    if (document.querySelector('.countdown-number')) return 'countdown';
    if (document.querySelector('.bidbar')) return 'auction';
    return 'other';
  });
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME });

  const host = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const guest = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();

  const errors: string[] = [];
  for (const [label, page] of [['host', host], ['guest', guest]] as const) {
    page.on('pageerror', (e) => errors.push(`${label}: ${e.message}`));
    page.on('console', (m) => m.type() === 'error' && errors.push(`${label}: ${m.text()}`));
  }

  await host.goto(URL);
  await host.fill('input[placeholder="z.B. Ruffy"]', 'Ruffy');
  await host.click('button:has-text("Neues Spiel erstellen")');
  await host.waitForSelector('.room-code');
  const code = (await host.textContent('.room-code'))!.trim();

  await guest.goto(URL);
  await guest.fill('input[placeholder="z.B. Ruffy"]', 'Zorro');
  await guest.fill('.code-input', code);
  await guest.click('button:has-text("Beitreten")');
  await guest.waitForSelector('.player-slots');
  await host.click('button:has-text("Spiel starten")');
  console.log(`→ Playing room ${code}`);

  const captured = new Set<string>();
  const deadline = Date.now() + 13 * 60 * 1000;
  let lastCategory = '';
  let auctionCount = 0;

  while (Date.now() < deadline) {
    const phase = await phaseOf(host);

    if (phase === 'game_over') {
      await wait(2500);
      await shot(host, '20-winner');
      break;
    }

    if (phase === 'final_reveal') {
      if (!captured.has('reveal')) {
        captured.add('reveal');
        await wait(1200);
        await shot(host, '18-reveal-start');
      }
      await tryClick(host, '.reveal-advance');
      await wait(900);
      if (!captured.has('reveal-mid') && (await host.locator('.rv-cell.open').count()) > 6) {
        captured.add('reveal-mid');
        await shot(host, '19-reveal-scores');
      }
      continue;
    }

    if (phase === 'trading') {
      if (!captured.has('trading')) {
        captured.add('trading');
        // Build a visible offer so the screenshot shows a populated market.
        await tryClick(host, '.partner');
        await wait(500);
        await shot(host, '16-trading');
        await tryClick(host, 'button:has-text("Angebot senden")');
        await wait(600);
        await shot(guest, '17-trade-incoming');
        await tryClick(guest, 'button:has-text("Annehmen")');
        await wait(400);
      }
      await tryClick(host, 'button:has-text("Fertig mit Handeln")');
      await tryClick(guest, 'button:has-text("Fertig mit Handeln")');
      await wait(500);
      continue;
    }

    if (phase === 'last_pick') {
      if (!captured.has('lastpick')) {
        captured.add('lastpick');
        await shot(host, '13-last-pick');
      }
      await tryClick(host, '.lastpick-card.pickable');
      await tryClick(guest, '.lastpick-card.pickable');
      await wait(400);
      continue;
    }

    if (phase === 'countdown' && !captured.has('countdown')) {
      captured.add('countdown');
      await shot(host, '12-countdown');
    }

    if (phase === 'auction') {
      const category = (await host.textContent('.stage-category').catch(() => '')) ?? '';
      if (category && category !== lastCategory) {
        lastCategory = category;
        console.log(`   ${category.trim()}`);
      }

      // Host bids, guest passes - fastest way to a completed board.
      const bid = await tryClick(host, '.btn.quick');
      if (bid) {
        auctionCount++;
        if (auctionCount === 2 && !captured.has('bid')) {
          captured.add('bid');
          await wait(300);
          await shot(host, '11-auction-bid');
        }
      }
      await tryClick(guest, '.btn.skip');

      if (!captured.has('board') && (await host.locator('.board-card').count()) >= 6) {
        captured.add('board');
        await shot(host, '14-board-filled');
        await shot(guest, '15-board-guest');
      }
    }

    await wait(700);
  }

  console.log(errors.length ? `\n⚠️  Errors:\n${[...new Set(errors)].join('\n')}` : '\n✓ No page errors');
  await browser.close();
  process.exit(0);
}

main().catch((e) => {
  console.error('✗ Playthrough failed:', e.message);
  process.exit(1);
});
