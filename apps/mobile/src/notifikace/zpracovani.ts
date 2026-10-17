import {
  najdiDuplicitu, odhadniKategorii, parseNotifikace, vytvorTransakci,
  type TransakceLehka, type TransakceWeb,
} from '@ff/core';
import type { Nerozpoznana, PolozkaHistorie } from '../uloziste';
import type { ZachycenaNotifikace } from './plugin';

export interface KontextZpracovani {
  vlastniBalicky: Record<string, string>;
  penezenky: Record<string, string>;
  /** Id kategorií, které uživatel opravdu má (odhad mimo ně se nezapíše). */
  kategorie: Set<string>;
  /** Poslední transakce z Firebase – kvůli duplicitám. Funkce do pole přidává zapsané. */
  transakce: TransakceLehka[];
  zapis: (tx: TransakceWeb) => Promise<void>;
  casovaZona?: string;
  ted?: number;
}

export interface VysledekZpracovani {
  historie: PolozkaHistorie[];
  nerozpoznane: Nerozpoznana[];
  /** Id položek, které se smí smazat z nativní fronty. */
  potvrdit: string[];
  /** Kolik zápisů selhalo (zůstávají ve frontě, zkusí se příště). */
  chyby: number;
}

/**
 * Fronta z telefonu → transakce ve Firebase.
 *
 * - platba v CZK bez dvojčete → zapíše se rovnou do transakcí
 * - stejná notifikace podruhé → nic (už zapsaná)
 * - stejná platba zapsaná jinak (ručně, výpis) → nezapíše se, appka nabídne „Přesto přidat“
 * - cizí měna → nezapíše se (bez kurzu by částka nebyla správně), appka ji ukáže
 * - není to provedená platba (budoucí splátka, ověření…) → zahodí se
 * - nerozpoznaná notifikace banky → text zůstane jen v telefonu, k doplnění parseru
 *
 * Když zápis selže (bez internetu), položka zůstane v nativní frontě a zkusí se znovu.
 * Zápis je bezpečné opakovat: id transakce je odvozené z notifikace.
 */
export async function zpracujPolozky(polozky: ZachycenaNotifikace[], k: KontextZpracovani): Promise<VysledekZpracovani> {
  const out: VysledekZpracovani = { historie: [], nerozpoznane: [], potvrdit: [], chyby: 0 };

  for (const p of [...polozky].sort((a, b) => a.cas - b.cas)) {
    const r = parseNotifikace({ balicek: p.balicek, titulek: p.titulek, text: p.text, cas: p.cas }, k.vlastniBalicky);

    if (r.stav === 'ignorovat') { out.potvrdit.push(p.id); continue; }
    if (r.stav === 'nerozpoznano') {
      if (r.banka) out.nerozpoznane.push({ id: p.id, cas: p.cas, balicek: p.balicek, titulek: p.titulek, text: p.text });
      out.potvrdit.push(p.id);
      continue;
    }

    const { banka, platba } = r;
    const odhad = odhadniKategorii(platba.protistrana);
    const catId = k.kategorie.has(odhad) ? odhad : '';
    const wallet = (platba.karta4 && k.penezenky[`${banka.id}:${platba.karta4}`]) || k.penezenky[banka.id] || undefined;

    let tx: TransakceWeb;
    try {
      tx = vytvorTransakci({ balicek: p.balicek, titulek: p.titulek, text: p.text, cas: p.cas }, banka, platba, {
        catId, ...(wallet ? { wallet } : {}), ...(k.casovaZona ? { casovaZona: k.casovaZona } : {}), ...(k.ted ? { ted: k.ted } : {}),
      });
    } catch {
      // Neplatná data (schéma) – nic nezapisovat, nechat k ručnímu doplnění.
      out.nerozpoznane.push({ id: p.id, cas: p.cas, balicek: p.balicek, titulek: p.titulek, text: p.text });
      out.potvrdit.push(p.id);
      continue;
    }

    const zaklad: PolozkaHistorie = {
      klic: tx.notifKlic, cas: p.cas, stav: 'zapsano', typ: tx.type, nazev: tx.name,
      castka: tx.amount, mena: tx.currency, banka: banka.id, ...(tx.karta4 ? { karta4: tx.karta4 } : {}),
    };

    if (tx.currency !== 'CZK') {
      out.historie.push({ ...zaklad, stav: 'jinaMena' });
      out.potvrdit.push(p.id);
      continue;
    }

    const d = najdiDuplicitu(tx, k.transakce);
    if (d.stav === 'uz-zapsana') { out.potvrdit.push(p.id); continue; }
    if (d.stav === 'mozna-duplicita') {
      out.historie.push({ ...zaklad, stav: 'duplicita', shodaNazev: d.transakce.name ?? '', shodaDatum: d.transakce.date ?? '', tx });
      out.potvrdit.push(p.id);
      continue;
    }

    try {
      await k.zapis(tx);
      k.transakce.push(tx);
      out.historie.push(zaklad);
      out.potvrdit.push(p.id);
    } catch {
      out.chyby++;
    }
  }
  return out;
}
