import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  jeSplacena, kontext, mesicniSplatky, podilSplaceno, poSplatnosti, pristiSplatka, zaplacenoNaDluh, zbyvaCelkem, type Dluh,
} from '@ff/core';
import { formatDatum, localePro, type KodJazyka } from '@ff/i18n';
import { useSklad } from '../data/sklad';
import { Castka } from '../komponenty/spolecne';

const TYPY = ['personal', 'mortgage', 'nonbank', 'credit', 'ico', 'friend'];

function dnes(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Půjčky (čtení) – klon karet webu (transactions.js renderDebts), výpočty z @ff/core. */
export function Pujcky() {
  const { t, i18n } = useTranslation();
  const jazyk = i18n.language as KodJazyka;
  const { data } = useSklad();
  const ted = new Date();
  const k = useMemo(() => kontext(data), [data]);
  const dluhy = data.debts ?? [];
  const aktivni = dluhy.filter(d => !jeSplacena(d));
  const splacene = dluhy.filter(d => jeSplacena(d));
  const pct = (n: number) => new Intl.NumberFormat(localePro(jazyk), { style: 'percent' }).format(n);
  const datum = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}/.test(s) ? formatDatum(s.slice(0, 10), jazyk) : '–');

  const Karta = ({ d }: { d: Dluh }) => {
    const zaplaceno = zaplacenoNaDluh(d, data, k);
    const pristi = pristiSplatka(d);
    const poSpl = poSplatnosti(d, dnes());
    const podil = podilSplaceno(d);
    const freq = d.freq === 'weekly' || d.freq === 'biweekly' ? d.freq : 'monthly';
    return (
      <section className="karta">
        <div className="radek">
          <span className="nazev">{d.name || t('pujcky.bezNazvu')}</span>
          {jeSplacena(d) && <span className="stitek ok-stitek">{t('pujcky.splaceno')}</span>}
        </div>
        <p className="male tlumene">
          {t(`pujcky.typ.${d.type && TYPY.includes(d.type) ? d.type : 'personal'}`)}
          {d.creditor ? ` · ${d.creditor}` : ''}
          {d.interest != null ? ` · ${t('pujcky.urok', { urok: new Intl.NumberFormat(localePro(jazyk), { maximumFractionDigits: 2 }).format(d.interest) })}` : ''}
        </p>
        {poSpl > 0 && <p className="male chyba" role="alert">{t('pujcky.poSplatnosti', { n: poSpl })}</p>}
        {podil != null && (
          <>
            <div className="pruh" aria-hidden="true"><div style={{ width: `${podil * 100}%`, background: 'var(--prijem)' }} /></div>
            <p className="male tlumene">{t('pujcky.splacenoZ', { pct: pct(podil) })} <Castka castka={d.total ?? 0} znamenko={false} /></p>
          </>
        )}
        <div className="mrizka-hodnot">
          <div><span className="stat-popis">{t('pujcky.zbyva')}</span><Castka castka={d.remaining ?? 0} typ={jeSplacena(d) ? undefined : 'expense'} znamenko={false} /></div>
          <div><span className="stat-popis">{t(`pujcky.frekvence.${freq}`)}</span><Castka castka={d.payment || d.installment || 0} znamenko={false} /></div>
          <div><span className="stat-popis">{t('pujcky.pristi')}</span><span>{pristi ? datum(pristi.date) : '–'}</span></div>
          <div><span className="stat-popis">{t('pujcky.zbyvaSplatek')}</span><span>{d.schedule?.length ? String(d.schedule.length) : '–'}</span></div>
        </div>
        {zaplaceno.pocet > 0 && (
          <p className="male">{t('pujcky.zaplacenoVAppce', { n: zaplaceno.pocet })} <Castka castka={zaplaceno.soucet} typ="income" znamenko={false} /></p>
        )}
      </section>
    );
  };

  return (
    <div className="sloupec">
      <h2>{t('vice.pujcky')}</h2>
      {dluhy.length === 0 ? <p className="karta tlumene">{t('pujcky.zadne')}</p> : (
        <section className="mrizka-karet">
          <div className="karta stat"><span className="stat-popis">{t('pujcky.zbyvaCelkem')}</span><Castka castka={zbyvaCelkem(data)} typ="expense" znamenko={false} /></div>
          <div className="karta stat"><span className="stat-popis">{t('pujcky.mesicneCelkem')}</span><Castka castka={mesicniSplatky(data, ted.getFullYear(), ted.getMonth())} znamenko={false} /></div>
        </section>
      )}
      {aktivni.map((d, i) => <Karta key={d.id ?? i} d={d} />)}
      {splacene.length > 0 && <h3>{t('pujcky.splacene')}</h3>}
      {splacene.map((d, i) => <Karta key={d.id ?? `s${i}`} d={d} />)}
      {dluhy.length > 0 && <p className="male tlumene">{t('pujcky.upravyNaWebu')}</p>}
    </div>
  );
}
