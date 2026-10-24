import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { idPresunovychKategorii, jePresun, kontext, prijmy, transakceMesice, vydaje, type Tx } from '@ff/core';
import { useSklad } from '../data/sklad';
import { Castka, obsahujeText, razeniTx, useKategorie, VyberMesice, type Mesic } from '../komponenty/spolecne';
import { SeznamPoDnech } from '../komponenty/seznam-transakci';

type Filtr = 'vse' | 'vydaje' | 'prijmy' | 'bezKategorie';
const FILTRY: Filtr[] = ['vse', 'vydaje', 'prijmy', 'bezKategorie'];

/**
 * Seznam transakcí měsíce po dnech, s hledáním a filtry. Klepnutí otevře úpravu.
 * `kategorie` = otevřeno z obrazovky Kategorie (jen transakce té kategorie).
 */
export function Transakce({ mesic, onMesic, onOtevrit, kategorie, onZrusitKategorii }: {
  mesic: Mesic; onMesic: (m: Mesic) => void; onOtevrit: (t: Tx) => void;
  kategorie?: string | null; onZrusitKategorii?: () => void;
}) {
  const { t } = useTranslation();
  const { data } = useSklad();
  const kat = useKategorie(data.categories);
  const [hledat, setHledat] = useState('');
  const [filtr, setFiltr] = useState<Filtr>('vse');

  const presunove = useMemo(() => idPresunovychKategorii(data), [data]);
  const znameKategorie = useMemo(() => new Set(data.categories.map(c => c.id)), [data]);

  const vybrane = useMemo(() => {
    return transakceMesice(data, mesic.rok, mesic.mesic)
      .filter(tx => !kategorie || tx.catId === kategorie)
      .filter(tx => {
        if (filtr === 'vydaje') return tx.type === 'expense';
        if (filtr === 'prijmy') return tx.type === 'income';
        if (filtr === 'bezKategorie') return !jePresun(tx, presunove) && !znameKategorie.has(String(tx.catId ?? ''));
        return true;
      })
      .filter(tx => obsahujeText(tx, hledat, kat(tx.catId).nazev))
      .sort(razeniTx);
  }, [data, mesic, filtr, hledat, presunove, znameKategorie, kat, kategorie]);

  const souhrn = useMemo(() => { const k = kontext(data); return { p: prijmy(vybrane, k), v: vydaje(vybrane, k) }; }, [data, vybrane]);
  const vybranaKat = kategorie ? kat(kategorie) : null;

  return (
    <div className="sloupec">
      <VyberMesice mesic={mesic} onZmena={onMesic} />
      {vybranaKat && (
        <div className="stitky">
          <button className="stitek-volba aktivni" onClick={onZrusitKategorii} aria-label={t('transakce.zrusitKategorii')}>
            {vybranaKat.ikona} {vybranaKat.nazev} ✕
          </button>
        </div>
      )}
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

      {vybrane.length === 0 && <p className="karta tlumene">{hledat || filtr !== 'vse' || kategorie ? t('transakce.nicNenalezeno') : t('transakce.prazdne')}</p>}

      <SeznamPoDnech transakce={vybrane} kategorie={data.categories} penezenky={data.wallets} presunove={presunove} onOtevrit={onOtevrit} />
    </div>
  );
}
