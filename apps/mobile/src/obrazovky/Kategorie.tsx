import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { kontext, skutecnost, type Kategorie as Kat } from '@ff/core';
import { useSklad } from '../data/sklad';
import { Castka, VyberMesice, type Mesic } from '../komponenty/spolecne';

type Skupina = 'vydaje' | 'prijmy' | 'presuny';

/**
 * Kategorie s částkou za měsíc (čtení). Klepnutí otevře Transakce té kategorie.
 * Čísla jako web (getActual): rozdělené rodiče s dětmi a vyrovnání se nepočítají,
 * přesuny jen u přesunových kategorií (spoření, investice).
 */
export function Kategorie({ mesic, onMesic, onOtevrit }: { mesic: Mesic; onMesic: (m: Mesic) => void; onOtevrit: (catId: string) => void }) {
  const { t } = useTranslation();
  const { data } = useSklad();

  const skupiny = useMemo(() => {
    const k = kontext(data);
    const radek = (c: Kat, typ: 'expense' | 'income') => ({ c, celkem: skutecnost(data, c.id, mesic.rok, mesic.mesic, k, typ) });
    const zobrazit = (r: { c: Kat; celkem: number }) => !r.c.archived || r.celkem > 0;
    const serad = (a: { celkem: number; c: Kat }, b: { celkem: number; c: Kat }) => b.celkem - a.celkem || a.c.name.localeCompare(b.c.name);
    const cats = data.categories.filter(c => c && c.id);
    const out: Record<Skupina, { c: Kat; celkem: number }[]> = {
      vydaje: cats.filter(c => c.type === 'expense' || c.type === 'both' || !c.type).map(c => radek(c, 'expense')).filter(zobrazit).sort(serad),
      prijmy: cats.filter(c => c.type === 'income' || c.type === 'both').map(c => radek(c, 'income')).filter(zobrazit).sort(serad),
      // Přesunové kategorie: kolik do nich tento měsíc odešlo (web: getActual s přímým dotazem na přesunovou kategorii).
      presuny: cats.filter(c => c.type === 'transfer').map(c => radek(c, 'expense')).filter(zobrazit).sort(serad),
    };
    return out;
  }, [data, mesic]);

  return (
    <div className="sloupec">
      <h2>{t('vice.kategorie')}</h2>
      <VyberMesice mesic={mesic} onZmena={onMesic} />
      {data.categories.length === 0 && <p className="karta tlumene">{t('kategorie.zadne')}</p>}
      {(['vydaje', 'prijmy', 'presuny'] as Skupina[]).map(s => skupiny[s].length > 0 && (
        <section key={s} className="karta">
          <h3>{t(`kategorie.skupina.${s}`)}</h3>
          <ul className="seznam">
            {skupiny[s].map(({ c, celkem }) => (
              <li key={c.id}>
                <button className="tx-radek" onClick={() => onOtevrit(c.id)}>
                  <span className="tx-ikona" aria-hidden="true" style={{ background: c.color ? `${c.color}22` : undefined }}>{c.icon || '📦'}</span>
                  <span className="tx-info">
                    <span className="nazev">{c.name}</span>
                    {(c.subs?.length ?? 0) > 0 && <span className="male tlumene">{t('kategorie.podkategorii', { n: c.subs!.length })}</span>}
                  </span>
                  {celkem > 0 ? <Castka castka={celkem} znamenko={false} /> : <span className="tlumene">–</span>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="male tlumene">{t('kategorie.upravyNaWebu')}</p>
    </div>
  );
}
