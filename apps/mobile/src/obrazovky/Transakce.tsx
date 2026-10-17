import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { idPresunovychKategorii, jePresun, kontext, prijmy, transakceMesice, vydaje, type Tx } from '@ff/core';
import { localePro, type KodJazyka } from '@ff/i18n';
import { useSklad } from '../data/sklad';
import { Castka, menaTx, obsahujeText, razeniTx, useKategorie, VyberMesice, type Mesic } from '../komponenty/spolecne';

type Filtr = 'vse' | 'vydaje' | 'prijmy' | 'bezKategorie';
const FILTRY: Filtr[] = ['vse', 'vydaje', 'prijmy', 'bezKategorie'];

/** Seznam transakcí měsíce po dnech, s hledáním a filtry. Klepnutí otevře úpravu. */
export function Transakce({ mesic, onMesic, onOtevrit }: { mesic: Mesic; onMesic: (m: Mesic) => void; onOtevrit: (t: Tx) => void }) {
  const { t, i18n } = useTranslation();
  const jazyk = i18n.language as KodJazyka;
  const { data } = useSklad();
  const kat = useKategorie(data.categories);
  const [hledat, setHledat] = useState('');
  const [filtr, setFiltr] = useState<Filtr>('vse');

  const presunove = useMemo(() => idPresunovychKategorii(data), [data]);
  const znameKategorie = useMemo(() => new Set(data.categories.map(c => c.id)), [data]);

  const vybrane = useMemo(() => {
    return transakceMesice(data, mesic.rok, mesic.mesic)
      .filter(tx => {
        if (filtr === 'vydaje') return tx.type === 'expense';
        if (filtr === 'prijmy') return tx.type === 'income';
        if (filtr === 'bezKategorie') return !jePresun(tx, presunove) && !znameKategorie.has(String(tx.catId ?? ''));
        return true;
      })
      .filter(tx => obsahujeText(tx, hledat, kat(tx.catId).nazev))
      .sort(razeniTx);
  }, [data, mesic, filtr, hledat, presunove, znameKategorie, kat]);

  const souhrn = useMemo(() => { const k = kontext(data); return { p: prijmy(vybrane, k), v: vydaje(vybrane, k) }; }, [data, vybrane]);

  const dny = useMemo(() => {
    const m = new Map<string, Tx[]>();
    for (const tx of vybrane) { const d = String(tx.date ?? '').slice(0, 10); m.set(d, [...(m.get(d) ?? []), tx]); }
    return [...m.entries()];
  }, [vybrane]);

  const formatDne = (d: string) => new Intl.DateTimeFormat(localePro(jazyk), { weekday: 'short', day: 'numeric', month: 'numeric' }).format(new Date(`${d}T12:00:00`));

  return (
    <div className="sloupec">
      <VyberMesice mesic={mesic} onZmena={onMesic} />
      <input type="search" className="hledani" placeholder={t('transakce.hledat')} aria-label={t('transakce.hledat')} value={hledat} onChange={e => setHledat(e.target.value)} />
      <div className="stitky" role="group">
        {FILTRY.map(f => (
          <button key={f} className={`stitek-volba ${filtr === f ? 'aktivni' : ''}`} aria-pressed={filtr === f} onClick={() => setFiltr(f)}>
            {t(`transakce.filtr.${f}`)}
          </button>
        ))}
      </div>
      <p className="male tlumene">
        {t('pocet.transakce', { n: vybrane.length })} · {t('prehled.vydaje')} <Castka castka={souhrn.v} znamenko={false} /> · {t('prehled.prijmy')} <Castka castka={souhrn.p} znamenko={false} />
      </p>

      {dny.length === 0 && <p className="karta tlumene">{hledat || filtr !== 'vse' ? t('transakce.nicNenalezeno') : t('transakce.prazdne')}</p>}

      {dny.map(([den, txs]) => (
        <section key={den} className="karta den">
          <h3 className="den-nadpis">{formatDne(den)}</h3>
          <ul className="seznam">
            {txs.map(tx => {
              const k = kat(tx.catId);
              const presun = jePresun(tx, presunove);
              return (
                <li key={String(tx.id)}>
                  <button className="tx-radek" onClick={() => onOtevrit(tx)}>
                    <span className="tx-ikona" aria-hidden="true">{k.ikona}</span>
                    <span className="tx-info">
                      <span className="nazev">{tx.name || k.nazev}</span>
                      <span className="male tlumene">
                        {k.nazev}
                        {presun && <> · {t('transakce.presun')}</>}
                        {tx.isBalancing && <> · {t('transakce.vyrovnani')}</>}
                        {tx.splitParent && <> · {t('transakce.rozdeleno')}</>}
                        {tx.zdroj === 'notifikace' && <> · {t('transakce.zNotifikace')}</>}
                      </span>
                    </span>
                    <Castka castka={Number(tx.amount || tx.amt || 0)} mena={menaTx(tx, data.wallets)} typ={presun ? undefined : tx.type} />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
