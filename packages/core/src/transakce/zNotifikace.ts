import type { BankaDef, RozpoznanaPlatba, VstupNotifikace } from '../parsery/typy';
import { vycistiText } from '../parsery/obecny';
import { TransakceWeb } from '../schema/transakce';

/** FNV-1a 32 bit – stabilní otisk textu (stejný na webu, v telefonu i v testech). */
export function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Otisk notifikace: balíček + čas + text. Tatáž notifikace = tentýž otisk. */
export function notifKlic(v: VstupNotifikace): string {
  return `${v.cas.toString(36)}-${hash32(`${v.balicek}|${v.titulek}|${v.text}`).toString(36)}`;
}

/**
 * Id ve stejném tvaru jako web (`Date.now()*16 + 0..15`), ale odvozené z notifikace.
 * Opakovaný zápis téže notifikace (výpadek sítě, restart) přepíše tutéž transakci
 * místo vytvoření druhé.
 */
export function idZNotifikace(v: VstupNotifikace): number {
  return v.cas * 16 + (hash32(`${v.balicek}|${v.titulek}|${v.text}`) % 16);
}

/** Datum v místním čase zařízení (nebo zadané zóně) ve tvaru YYYY-MM-DD. */
export function datumMistni(cas: number, casovaZona?: string): string {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: casovaZona, year: 'numeric', month: '2-digit', day: '2-digit',
  });
  return f.format(new Date(cas));
}

export interface VolbyTransakce {
  catId: string;
  wallet?: string;
  /** Název, když notifikace obchodníka neuvádí (titulek notifikace bez emoji). */
  nazevZaloha?: string;
  casovaZona?: string;
  ted?: number;
}

/** Sestaví transakci pro web a ověří ji schématem (při chybě vyhodí výjimku – nic se nezapíše). */
export function vytvorTransakci(
  v: VstupNotifikace, banka: BankaDef, p: RozpoznanaPlatba, volby: VolbyTransakce,
): TransakceWeb {
  const aplikace = banka.aplikace.find(a => a.balicek === v.balicek)?.nazev ?? banka.nazev;
  const nazev = p.protistrana || volby.nazevZaloha || vycistiText(v.titulek) || banka.nazev;
  const tx = {
    id: idZNotifikace(v),
    type: p.typ,
    name: nazev.slice(0, 299),
    amount: p.castka,
    amt: p.castka,
    catId: volby.catId,
    category: volby.catId,
    date: datumMistni(v.cas, volby.casovaZona),
    ...(volby.wallet ? { wallet: volby.wallet } : {}),
    currency: p.mena,
    note: `📱 ${aplikace}`,
    createdAt: volby.ted ?? Date.now(),
    zdroj: 'notifikace' as const,
    notifKlic: notifKlic(v),
    notifBanka: banka.id,
    ...(p.karta4 ? { karta4: p.karta4 } : {}),
  };
  return TransakceWeb.parse(tx);
}
