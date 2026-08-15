/** Money formatting. Big numbers are the game's main readable surface. */

const MIO = 1_000_000;
const MRD = 1_000_000_000;

/** Compact form for HUDs and cards: "850 Mio.", "1,24 Mrd." */
export function money(value: number): string {
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs >= MRD) {
    const v = abs / MRD;
    return `${sign}${v.toFixed(2).replace('.', ',').replace(/,?0+$/, '')} Mrd.`;
  }
  if (abs >= MIO) return `${sign}${Math.round(abs / MIO)} Mio.`;
  return `${sign}${abs.toLocaleString('de-DE')}`;
}

/** Full dotted form for the auction stage: "150.000.000" */
export function moneyFull(value: number): string {
  return Math.round(value).toLocaleString('de-DE');
}

/** Signed compact form for trades and injections: "+35 Mio." */
export function moneySigned(value: number): string {
  if (value === 0) return '±0';
  return `${value > 0 ? '+' : ''}${money(value)}`;
}

export function seconds(ms: number): number {
  return Math.max(0, Math.ceil(ms / 1000));
}
