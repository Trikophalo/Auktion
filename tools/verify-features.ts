/**
 * Browser check for the lobby settings, the time-skip vote, the extending
 * timer, the auto-assign ceremony and the chat.
 *
 *   npm start &
 *   npx tsx tools/verify-features.ts [outDir]
 */
import { chromium, type Page } from 'playwright';
import { mkdir } from 'node:fs/promises';

const URL = process.env.SHOT_URL ?? 'http://localhost:3000';
const OUT = process.argv[2] ?? 'screenshots';
const CHROME = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const shot = async (page: Page, name: string) => {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`  📸 ${name}.png`);
};

async function tryClick(page: Page, selector: string): Promise<boolean> {
  try {
    const el = page.locator(selector).first();
    if ((await el.count()) === 0 || !(await el.isEnabled({ timeout: 300 }))) return false;
    await el.click({ timeout: 900 });
    return true;
  } catch {
    return false;
  }
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
  const check = (ok: boolean, label: string) => {
    console.log(`  ${ok ? '✓' : '✗'} ${label}`);
    if (!ok) errors.push(`CHECK FAILED: ${label}`);
  };

  // ---------------------------------------------------------------- lobby
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
  await wait(500);

  console.log('\n→ Lobby settings');
  check(await host.locator('.room-settings').isVisible(), 'settings panel visible');
  // Auction length: set to the 5 minute maximum.
  await host.locator('.setting input[type=range]').first().fill('300');
  await wait(400);
  const hostLabel = await host.locator('.setting-head b').first().textContent();
  const guestLabel = await guest.locator('.setting-head b').first().textContent();
  check(hostLabel?.includes('5') ?? false, `host sees 5 Min. (${hostLabel})`);
  check(hostLabel === guestLabel, `guest sees the same value live (${guestLabel})`);

  // Injection mode toggle.
  await tryClick(host, '.mode-toggle button:has-text("Gleich")');
  await wait(400);
  check(
    (await guest.locator('.mode-toggle button.selected').textContent())?.includes('Gleich') ?? false,
    'injection mode syncs to the guest',
  );
  // Guest must not be able to change anything.
  check(await guest.locator('.mode-toggle button').first().isDisabled(), 'guest controls are read-only');
  await shot(host, 'f1-lobby-settings');

  console.log('\n→ Lobby chat');
  await host.fill('.chat.panel .chat-input input', 'Ich nehme Roger, Finger weg!');
  await host.press('.chat.panel .chat-input input', 'Enter');
  await wait(600);
  check((await guest.locator('.chat-text').last().textContent())?.includes('Finger weg') ?? false, 'chat reaches the guest');
  await shot(guest, 'f2-lobby-chat');

  // ---------------------------------------------------------------- game
  console.log('\n→ Auction timer');
  await host.click('button:has-text("Spiel starten")');
  await host.waitForSelector('.auction-clock', { timeout: 25_000 });
  await wait(600);

  const clock = (await host.textContent('.auction-clock .clock-value'))!;
  check(/^[45]:\d\d$/.test(clock.trim()), `clock starts near 5:00 (${clock.trim()})`);
  await shot(host, 'f3-auction-clock');

  console.log('\n→ Time skip vote');
  await tryClick(host, '.btn.time-skip');
  await wait(500);
  const votes = await host.textContent('.btn.time-skip .ts-count');
  check(votes?.trim() === '1/2', `one vote registered (${votes?.trim()})`);
  const stillLong = (await host.textContent('.auction-clock .clock-value'))!;
  check(stillLong.includes(':'), 'clock unchanged after a single vote');

  await tryClick(guest, '.btn.time-skip');
  await wait(900);
  const afterVote = (await host.textContent('.auction-clock .clock-value'))!.trim();
  check(/^\d+s$/.test(afterVote), `both voted -> clock cut to seconds (${afterVote})`);
  await shot(host, 'f4-time-skipped');

  console.log('\n→ Bidding during the big countdown');
  // Wait for the dramatic overlay, then bid while it is on screen.
  await host.waitForSelector('.countdown-number', { timeout: 15_000 });
  await shot(host, 'f5-countdown-bidding');
  const bidWorked = await tryClick(host, '.btn.quick');
  check(bidWorked, 'bid button is clickable during the countdown');
  await wait(800);
  const afterBid = (await host.textContent('.auction-clock .clock-value'))!.trim();
  const seconds = Number(afterBid.replace('s', ''));
  check(seconds >= 8, `bid reset the clock back to ~10s (${afterBid})`);

  console.log('\n→ Auto-assign ceremony');
  // Guest passes, so the remaining character is handed over automatically.
  let sawAssign = false;
  for (let i = 0; i < 40 && !sawAssign; i++) {
    await tryClick(guest, '.btn.skip');
    await tryClick(host, '.btn.quick');
    if (await host.locator('.assign-card').count()) {
      sawAssign = true;
      await wait(700);
      await shot(host, 'f6-auto-assign');
      const price = await host.textContent('.at-price');
      check(/Mindestpreis|GRATIS/.test(price ?? ''), `handed over at the minimum price (${price?.trim()})`);
    }
    await wait(700);
  }
  check(sawAssign, 'auto-assign ceremony appeared');

  console.log('\n→ In-game chat');
  await tryClick(host, '.chat-toggle');
  await wait(400);
  await host.fill('.chat.dock .chat-input input', 'Viel Spaß mit dem Rest 😄');
  await host.press('.chat.dock .chat-input input', 'Enter');
  await wait(700);
  check(
    (await host.locator('.chat-msg.system').count()) > 0,
    'system log lines appear in the chat',
  );
  await shot(host, 'f7-game-chat');

  console.log(errors.length ? `\n⚠️  Problems:\n${[...new Set(errors)].join('\n')}` : '\n✓ All checks passed, no page errors');
  await browser.close();
  process.exit(errors.length ? 1 : 0);
}

main().catch((e) => {
  console.error('✗ Verification failed:', e.message);
  process.exit(1);
});
