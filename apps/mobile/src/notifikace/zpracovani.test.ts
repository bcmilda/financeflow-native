import { describe, expect, it } from 'vitest';
import type { TransakceWeb } from '@ff/core';
import { zpracujPolozky, type KontextZpracovani } from './zpracovani';

const cas = Date.parse('2026-10-16T18:30:00+02:00');
const karta = (id: string, text: string, posun = 0) => ({ id, balicek: 'cz.kb.ndb', titulek: 'Platba kartou', text, cas: cas + posun });

function kontext(o: Partial<KontextZpracovani> = {}): KontextZpracovani & { zapsane: TransakceWeb[] } {
  const zapsane: TransakceWeb[] = [];
  return {
    vlastniBalicky: {}, penezenky: { kb: 'w-kb', 'kb:9999': 'w-kredit' },
    transakce: [], zapis: async tx => { zapsane.push(tx); }, casovaZona: 'Europe/Prague', ted: 1, zapsane, ...o,
  };
}

describe('fronta notifikací → transakce', () => {
  it('platba kartou se zapíše s peněženkou banky a BEZ kategorie (žádný odhad, N-008)', async () => {
    const k = kontext();
    const r = await zpracujPolozky([karta('a', '145,40 Kč  u obchodníka Penny Ostrava, 💳 VISA Classic 4111 11** **** 1234.')], k);
    expect(k.zapsane).toHaveLength(1);
    expect(k.zapsane[0]).toMatchObject({ name: 'Penny Ostrava', amount: 145.4, catId: '', category: '', wallet: 'w-kb', date: '2026-10-16' });
    expect(r.potvrdit).toEqual(['a']);
  });

  it('karta s vlastní peněženkou (kreditka) má přednost před peněženkou banky', async () => {
    const k = kontext();
    await zpracujPolozky([karta('a', '99,00 Kč  u obchodníka Lidl Brno, 💳 Mastercard 5555 55** **** 9999.')], k);
    expect(k.zapsane[0]?.wallet).toBe('w-kredit');
  });

  it('budoucí splátka se zahodí a nic se nezapíše', async () => {
    const k = kontext();
    const r = await zpracujPolozky([{ id: 'b', balicek: 'cz.kb.ndb', titulek: 'Končí bezúročné období', text: 'Automatická splátka 1 000,00 Kč vaší kreditní karty proběhne 20.10.2026 ráno.', cas }], k);
    expect(k.zapsane).toHaveLength(0);
    expect(r.potvrdit).toEqual(['b']);
    expect(r.historie).toHaveLength(0);
  });

  it('ručně zapsaná stejná platba → nezapíše se, nabídne se „Přesto přidat“', async () => {
    const k = kontext({ transakce: [{ id: 1, type: 'expense', amount: 145.4, date: '2026-10-16', name: 'Penny' }] });
    const r = await zpracujPolozky([karta('a', '145,40 Kč  u obchodníka Penny Ostrava, 💳 VISA 4111 11** **** 1234.')], k);
    expect(k.zapsane).toHaveLength(0);
    expect(r.historie[0]).toMatchObject({ stav: 'duplicita', shodaNazev: 'Penny' });
  });

  it('dvě stejné platby po sobě (dvě kávy) se zapíšou obě', async () => {
    const k = kontext();
    await zpracujPolozky([
      karta('a', '65,00 Kč  u obchodníka Costa Coffee, 💳 VISA 4111 11** **** 1234.'),
      karta('b', '65,00 Kč  u obchodníka Costa Coffee, 💳 VISA 4111 11** **** 1234.', 60_000),
    ], k);
    expect(k.zapsane).toHaveLength(2);
    expect(k.zapsane[0]?.id).not.toBe(k.zapsane[1]?.id);
  });

  it('bez internetu zůstane položka ve frontě (nepotvrdí se)', async () => {
    const k = kontext({ zapis: async () => { throw new Error('offline'); } });
    const r = await zpracujPolozky([karta('a', '145,40 Kč  u obchodníka Penny Ostrava, 💳 VISA 4111 11** **** 1234.')], k);
    expect(r.potvrdit).toEqual([]);
    expect(r.chyby).toBe(1);
  });

  it('nerozpoznané oznámení banky zůstane v telefonu k doplnění', async () => {
    const k = kontext();
    const r = await zpracujPolozky([{ id: 'c', balicek: 'cz.kb.ndb', titulek: 'Novinka', text: 'Vyzkoušejte nové funkce', cas }], k);
    expect(r.nerozpoznane).toHaveLength(1);
    expect(r.potvrdit).toEqual(['c']);
  });

  it('platba v eurech se nezapíše (bez kurzu by částka nebyla správně)', async () => {
    const k = kontext();
    const r = await zpracujPolozky([karta('a', '12,50 EUR  u obchodníka Billa Wien, 💳 VISA 4111 11** **** 1234.')], k);
    expect(k.zapsane).toHaveLength(0);
    expect(r.historie[0]?.stav).toBe('jinaMena');
  });
});
