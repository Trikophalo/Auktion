/**
 * Procedural character portraits.
 *
 * Real artwork can be dropped in per character (see `CHARACTER_IMAGES` in the
 * theme data) - this is the guaranteed fallback so a missing or blocked image
 * never leaves a broken card on the board. It is drawn on a canvas, which also
 * makes the pixelated reveal authentic rather than a blur filter.
 */

export function hashOf(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

interface DrawOptions {
  id: string;
  name: string;
  accent: string;
  width: number;
  height: number;
}

/** Deterministic portrait: colours, silhouette and monogram all derive from the id. */
export function drawPortrait(target: HTMLCanvasElement, opts: DrawOptions) {
  const { id, name, accent, width, height } = opts;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  target.width = width * dpr;
  target.height = height * dpr;

  const ctx = target.getContext('2d');
  if (!ctx) return;
  ctx.scale(dpr, dpr);

  const h = hashOf(id);
  const hue = h % 360;
  const hue2 = (hue + 40 + (h % 60)) % 360;

  // Background
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, `hsl(${hue} 55% 26%)`);
  bg.addColorStop(1, `hsl(${hue2} 60% 14%)`);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Sunburst rays behind the figure
  ctx.save();
  ctx.translate(width / 2, height * 0.52);
  ctx.globalAlpha = 0.14;
  const rays = 12 + (h % 6);
  for (let i = 0; i < rays; i++) {
    ctx.rotate((Math.PI * 2) / rays);
    ctx.fillStyle = i % 2 === 0 ? accent : '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(width, -width * 0.09);
    ctx.lineTo(width, width * 0.09);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Horizon glow
  const glow = ctx.createRadialGradient(width / 2, height * 0.62, 4, width / 2, height * 0.62, width * 0.65);
  glow.addColorStop(0, `hsla(${hue2} 90% 62% / 0.55)`);
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  // Silhouette: shoulders + head, with a hat/hair shape chosen by the hash
  const cx = width / 2;
  const headR = width * 0.15;
  const headY = height * 0.42;

  ctx.fillStyle = 'rgba(6, 12, 24, 0.86)';
  ctx.beginPath();
  ctx.moveTo(cx - width * 0.34, height);
  ctx.quadraticCurveTo(cx - width * 0.3, height * 0.62, cx, height * 0.6);
  ctx.quadraticCurveTo(cx + width * 0.3, height * 0.62, cx + width * 0.34, height);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, headY, headR, 0, Math.PI * 2);
  ctx.fill();

  const style = h % 4;
  ctx.beginPath();
  if (style === 0) {
    // Straw-hat style brim
    ctx.ellipse(cx, headY - headR * 0.5, headR * 2, headR * 0.42, 0, 0, Math.PI * 2);
  } else if (style === 1) {
    // Tricorn / captain's hat
    ctx.moveTo(cx - headR * 1.8, headY - headR * 0.5);
    ctx.quadraticCurveTo(cx, headY - headR * 2.4, cx + headR * 1.8, headY - headR * 0.5);
    ctx.quadraticCurveTo(cx, headY - headR * 0.9, cx - headR * 1.8, headY - headR * 0.5);
  } else if (style === 2) {
    // Wild hair
    ctx.moveTo(cx - headR * 1.3, headY - headR * 0.2);
    ctx.quadraticCurveTo(cx - headR * 0.6, headY - headR * 2.1, cx, headY - headR * 1.1);
    ctx.quadraticCurveTo(cx + headR * 0.7, headY - headR * 2.2, cx + headR * 1.3, headY - headR * 0.2);
  } else {
    // Bandana with tails
    ctx.moveTo(cx - headR * 1.15, headY - headR * 0.55);
    ctx.lineTo(cx + headR * 1.15, headY - headR * 0.75);
    ctx.lineTo(cx + headR * 1.9, headY + headR * 0.35);
    ctx.lineTo(cx + headR * 1.0, headY - headR * 0.1);
    ctx.closePath();
  }
  ctx.fill();

  // Monogram
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 ${width * 0.42}px "Arial Black", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name.charAt(0).toUpperCase(), cx, height * 0.5);
  ctx.restore();

  // Vignette
  const vignette = ctx.createRadialGradient(cx, height / 2, width * 0.25, cx, height / 2, width * 0.75);
  vignette.addColorStop(0, 'transparent');
  vignette.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
}

/**
 * Renders `source` into `target` at a reduced resolution and scales it back up
 * with smoothing disabled: true mosaic pixelation, exactly like the reveal in
 * the reference. level 0 = crisp, level 1 = unrecognisable blocks.
 */
export function pixelate(source: HTMLCanvasElement, target: HTMLCanvasElement, level: number) {
  const ctx = target.getContext('2d');
  if (!ctx) return;

  const width = target.width;
  const height = target.height;

  if (level <= 0.001) {
    ctx.imageSmoothingEnabled = true;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(source, 0, 0, width, height);
    return;
  }

  // 3 blocks across at full pixelation, up to ~110 as it resolves.
  const blocks = Math.max(3, Math.round(110 - level * 107));
  const smallW = Math.max(2, Math.round(blocks));
  const smallH = Math.max(2, Math.round((blocks * height) / width));

  const scratch = document.createElement('canvas');
  scratch.width = smallW;
  scratch.height = smallH;
  const sctx = scratch.getContext('2d');
  if (!sctx) return;

  sctx.imageSmoothingEnabled = true;
  sctx.drawImage(source, 0, 0, smallW, smallH);

  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(scratch, 0, 0, smallW, smallH, 0, 0, width, height);
}
