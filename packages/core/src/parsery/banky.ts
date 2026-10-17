import { obecnaPravidla } from './obecny';
import type { BankaDef } from './typy';

/**
 * Katalog bank. Nová banka = nový záznam tady + vzorky skutečných notifikací v testech.
 * Postup je v doc/BANKY.md.
 */

// ── KB (KB+) ─ ověřeno na skutečných notifikacích (Milan, 17. 10. 2026) ──────────
//   titulek „Platba kartou“, text „145,40 Kč  u obchodníka Penny Ostrava, 💳 VISA Classic 4111 11** **** 1234.“
//   titulek „💸 Odchozí platba“, text „840,00 Kč z účtu 123-4567890123/0100 …“
//   titulek „Končí bezúročné období“, text „Automatická splátka 1 000,00 Kč … proběhne 20.10.2026 ráno.“ → ignorovat
//   Obecná pravidla je zvládají celé, vlastní pravidlo KB nepotřebuje (vzorky v test/kb.test.ts).

export const BANKY: BankaDef[] = [
  {
    id: 'kb', nazev: 'Komerční banka', pravidlaOverena: true,
    aplikace: [{ balicek: 'cz.kb.ndb', nazev: 'KB+', overeno: true }],
    rozpoznej: obecnaPravidla,
  },
  {
    id: 'csas', nazev: 'Česká spořitelna', pravidlaOverena: false,
    aplikace: [{ balicek: 'cz.csas.georgego', nazev: 'George', overeno: true }],
    rozpoznej: obecnaPravidla,
  },
  {
    id: 'csob', nazev: 'ČSOB', pravidlaOverena: false,
    aplikace: [{ balicek: 'cz.csob.smart', nazev: 'ČSOB Smart', overeno: true }],
    rozpoznej: obecnaPravidla,
  },
  {
    id: 'moneta', nazev: 'MONETA Money Bank', pravidlaOverena: false,
    aplikace: [{ balicek: 'cz.moneta.smartbanka', nazev: 'Smart Banka', overeno: true }],
    rozpoznej: obecnaPravidla,
  },
  {
    id: 'fio', nazev: 'Fio banka', pravidlaOverena: false,
    aplikace: [{ balicek: 'cz.fio.sb2', nazev: 'Fio Smartbanking', overeno: true }],
    rozpoznej: obecnaPravidla,
  },
  {
    id: 'revolut', nazev: 'Revolut', pravidlaOverena: false,
    aplikace: [{ balicek: 'com.revolut.revolut', nazev: 'Revolut', overeno: true }],
    rozpoznej: obecnaPravidla,
  },
  {
    id: 'airbank', nazev: 'Air Bank', pravidlaOverena: false,
    aplikace: [{ balicek: 'cz.airbank.android', nazev: 'My Air', overeno: false }],
    rozpoznej: obecnaPravidla,
  },
  {
    id: 'rb', nazev: 'Raiffeisenbank', pravidlaOverena: false,
    aplikace: [{ balicek: 'cz.rb.app.smartphonebanking', nazev: 'Mobilní banka RB', overeno: false }],
    rozpoznej: obecnaPravidla,
  },
  {
    id: 'unicredit', nazev: 'UniCredit Bank', pravidlaOverena: false,
    aplikace: [{ balicek: 'cz.unicredit.smartbanking', nazev: 'Smart Banking', overeno: false }],
    rozpoznej: obecnaPravidla,
  },
  {
    id: 'mbank', nazev: 'mBank', pravidlaOverena: false,
    aplikace: [{ balicek: 'cz.mbank', nazev: 'mBank CZ', overeno: false }],
    rozpoznej: obecnaPravidla,
  },
];

/** Balíček → banka. Vlastní (uživatelem přidané) balíčky mají přednost. */
export function najdiBanku(balicek: string, vlastni: Record<string, string> = {}): BankaDef | null {
  const id = vlastni[balicek];
  if (id) return BANKY.find(b => b.id === id) ?? null;
  return BANKY.find(b => b.aplikace.some(a => a.balicek === balicek)) ?? null;
}

export function vsechnyBalicky(): string[] {
  return BANKY.flatMap(b => b.aplikace.map(a => a.balicek));
}
