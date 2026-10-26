import { describe, expect, it } from 'vitest';
import type { TransakceWeb } from '@ff/core';
import { zpracujPolozky, type KontextZpracovani } from './zpracovani';

const cas = Date.parse('2026-10-16T18:30:00+02:00');
const karta = (id: string, text: string, posun = 0) => ({ id, balicek: 'cz.kb.ndb', titulek: 'Platba kartou', text, cas: cas + posun });

const upravy: { id: number | string; z: Record<string, unknown> }[] = [];
function kontext(o: Partial<KontextZpracovani> = {}): KontextZpracovani & { zapsane: TransakceWeb[] } {
  const zapsane: TransakceWeb[] = [];
  upravy.length = 0;
  return {
    vlastniBalicky: {}, penezenky: { kb: 'w-kb', 'kb:9999': 'w-kredit' },
    transakce: [], zapis: async tx => { zapsane.push(tx); }, uprav: async (id, z) => { upravy.push({ id, z }); }, casovaZona: 'Europe/Prague', ted: 1, zapsane, ...o,
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

/**
 * Skutečné chování KB+ (web v12.06, Milan 22. 10. 2026): jedna platba přišla dvakrát –
 * nejdřív krátké oznámení bez karty, za chvíli plné s kartou.
 */
describe('KB+ krátké a plné oznámení téže platby', () => {
  const T = Date.parse('2026-10-22T12:16:00+02:00');
  const kratke = { id: 'k', balicek: 'cz.kb.ndb', titulek: 'Platba kartou', text: 'Platba 1 168 Kč u obchodníka Alza.cz', cas: T };
  const plne = { id: 'p', balicek: 'cz.kb.ndb', titulek: 'Platba kartou', text: 'Platba 1 168 Kč u obchodníka Alza.cz, 💳 VISA Classic 4111 11** **** 9999.', cas: T + 20_000 };

  it('obě v jedné dávce → jedna transakce, karta a peněženka karty se doplní', async () => {
    const k = kontext();
    const r = await zpracujPolozky([plne, kratke], k);
    expect(k.zapsane).toHaveLength(1);
    expect(k.zapsane[0]).toMatchObject({ name: 'Alza.cz', amount: 1168, notifObchodnik: 'Alza.cz' });
    // karta 9999 má vlastní peněženku (kreditka) → nahradí automatickou peněženku banky
    expect(upravy).toEqual([{ id: k.zapsane[0]!.id, z: { karta4: '9999', wallet: 'w-kredit' } }]);
    expect(r.potvrdit.sort()).toEqual(['k', 'p']);
  });

  it('plné přijde až v další dávce (transakce už je ve Firebase) → jen doplnění', async () => {
    const k1 = kontext();
    await zpracujPolozky([kratke], k1);
    const ulozena = { ...k1.zapsane[0]! };
    const k2 = kontext({ transakce: [ulozena] });
    await zpracujPolozky([plne], k2);
    expect(k2.zapsane).toHaveLength(0);
    expect(upravy[0]?.z).toEqual({ karta4: '9999', wallet: 'w-kredit' });
  });

  it('peněženku, kterou uživatel sám změnil, doplnění nepřepíše', async () => {
    const k1 = kontext();
    await zpracujPolozky([kratke], k1);
    await zpracujPolozky([plne], kontext({ transakce: [{ ...k1.zapsane[0]!, wallet: 'w-hotovost' }] }));
    expect(upravy[0]?.z).toEqual({ karta4: '9999' });
  });

  it('krátké bez obchodníka → název z plného, ale jen když ho uživatel nepřepsal', async () => {
    const bezObch = { ...kratke, text: '1 168,00 Kč kartou' };
    const k1 = kontext();
    await zpracujPolozky([bezObch], k1);
    expect(k1.zapsane[0]?.name).toBe('Platba kartou');
    await zpracujPolozky([plne], kontext({ transakce: [{ ...k1.zapsane[0]! }] }));
    expect(upravy[0]?.z).toMatchObject({ name: 'Alza.cz', notifObchodnik: 'Alza.cz', karta4: '9999' });
    await zpracujPolozky([plne], kontext({ transakce: [{ ...k1.zapsane[0]!, name: 'Dárek pro mámu' }] }));
    expect(upravy[0]?.z).not.toHaveProperty('name');
  });

  it('dvě úplná stejná oznámení do 10 minut = dvě platby (dvě kávy), ne doplnění', async () => {
    const k = kontext();
    await zpracujPolozky([plne, { ...plne, id: 'p2', cas: plne.cas + 120_000 }], k);
    expect(k.zapsane).toHaveLength(2);
  });

  it('stejná částka po víc než 10 minutách = nová platba', async () => {
    const k = kontext();
    await zpracujPolozky([kratke, { ...plne, cas: T + 11 * 60_000 }], k);
    expect(k.zapsane).toHaveLength(2);
  });

  it('jiný obchodník = jiná platba', async () => {
    const k = kontext();
    await zpracujPolozky([kratke, { ...plne, text: 'Platba 1 168 Kč u obchodníka Datart, 💳 VISA 4111 11** **** 9999.' }], k);
    expect(k.zapsane).toHaveLength(2);
  });
});
