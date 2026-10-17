import { najdiBanku } from './banky';
import type { VstupNotifikace, VysledekParseru } from './typy';

export * from './typy';
export { BANKY, najdiBanku, vsechnyBalicky } from './banky';
export { parseCastka, normMena } from './cislo';
export { obecnaPravidla, vycistiText } from './obecny';

/**
 * Hlavní vstup: notifikace z telefonu → platba / ignorovat / nerozpoznáno.
 *
 * @param vlastni  balíček → id banky, když uživatel přiřadil aplikaci ručně
 *                 (např. novou verzi aplikace banky s jiným balíčkem).
 */
export function parseNotifikace(v: VstupNotifikace, vlastni: Record<string, string> = {}): VysledekParseru {
  const banka = najdiBanku(v.balicek, vlastni);
  if (!banka) return { stav: 'nerozpoznano', banka: null };
  const r = banka.rozpoznej(v.titulek ?? '', v.text ?? '');
  if (!r) return { stav: 'nerozpoznano', banka };
  if ('ignorovat' in r) return { stav: 'ignorovat', banka, duvod: r.ignorovat };
  return { stav: 'platba', banka, platba: r };
}
