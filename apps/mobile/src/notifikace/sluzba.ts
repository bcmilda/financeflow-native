import { REGIONY } from '@ff/i18n';
import { nactiPosledniTransakce, upravTransakci, zapisTransakci } from '../firebase';
import {
  nactiHistorii, nactiNastaveni, nactiNerozpoznane, ulozHistorii, ulozNerozpoznane, type PolozkaHistorie,
} from '../uloziste';
import { BankovniNotifikace } from './plugin';
import { zpracujPolozky } from './zpracovani';
import type { TransakceWeb } from '@ff/core';

let bezi: Promise<number> | null = null;

/**
 * Vyzvedne frontu z nativního modulu a zpracuje ji. Volá se při startu appky,
 * při návratu do appky a při každé nové notifikaci, když appka běží.
 * Souběžná volání se spojí do jednoho (zámek), aby se nic nezapsalo dvakrát.
 *
 * @returns počet nově zapsaných transakcí
 */
export function zpracujFrontu(uid: string): Promise<number> {
  if (bezi) return bezi;
  bezi = (async () => {
    try {
      const { polozky } = await BankovniNotifikace.vyzvednout();
      if (!polozky.length) return 0;
      const [nastaveni, transakce] = await Promise.all([
        nactiNastaveni(), nactiPosledniTransakce(uid),
      ]);
      const r = await zpracujPolozky(polozky, {
        vlastniBalicky: nastaveni.vlastniBalicky,
        penezenky: nastaveni.penezenky,
        transakce,
        zapis: tx => zapisTransakci(uid, tx),
        uprav: (id, zmeny) => upravTransakci(uid, id, zmeny),
        casovaZona: Intl.DateTimeFormat().resolvedOptions().timeZone || REGIONY[0].casovaZona,
      });
      if (r.historie.length || r.doplneno.length) {
        const h = [...r.historie, ...(await nactiHistorii())].map(x => {
          const d = r.doplneno.find(y => y.klic === x.klic);
          return d ? { ...x, ...(d.nazev ? { nazev: d.nazev } : {}), ...(d.karta4 ? { karta4: d.karta4 } : {}) } : x;
        });
        await ulozHistorii(h);
      }
      if (r.nerozpoznane.length) await ulozNerozpoznane([...r.nerozpoznane, ...(await nactiNerozpoznane())]);
      if (r.potvrdit.length) await BankovniNotifikace.potvrdit({ ids: r.potvrdit });
      return r.historie.filter(h => h.stav === 'zapsano').length;
    } finally {
      bezi = null;
    }
  })();
  return bezi;
}

/** „Přesto přidat“ u možné duplicity. */
export async function pridatPresto(uid: string, polozka: PolozkaHistorie): Promise<void> {
  if (!polozka.tx) return;
  await zapisTransakci(uid, polozka.tx as TransakceWeb);
  await zmenStav(polozka.klic, 'zapsano');
}

export async function zahodit(polozka: PolozkaHistorie): Promise<void> {
  await zmenStav(polozka.klic, 'zahozeno');
}

async function zmenStav(klic: string, stav: PolozkaHistorie['stav']): Promise<void> {
  const h = await nactiHistorii();
  await ulozHistorii(h.map(x => (x.klic === klic ? { ...x, stav, tx: undefined } : x)));
}
