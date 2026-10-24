import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { menaPenezenky, parseCastka, ruzneMeny, vytvorPresun, zkontrolovatPresun, type ChybaPresunu, type Tx } from '@ff/core';
import { formatCasRelativne, formatDatum, type KodJazyka } from '@ff/i18n';
import { nactiKoncept, smazatKoncept, ulozKoncept, type Koncept } from '../data/koncepty';
import { pridatTransakci, smazatTransakci, useSklad } from '../data/sklad';
import { Castka } from '../komponenty/spolecne';

interface HodnotyPresunu { z: string; do: string; castka: string; castkaCil: string; datum: string; poznamka: string }
const KLIC = 'presun:novy';

function dnes(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Přesun mezi peněženkami – zapíše dvě transakce jako web (výdaj z jedné, příjem do druhé,
 * společné transferId). Rozepsaný přesun se ukládá jako koncept.
 */
export function Presun({ z, onHotovo }: { z?: string | null; onHotovo: () => void }) {
  const { t, i18n } = useTranslation();
  const jazyk = i18n.language as KodJazyka;
  const { data } = useSklad();
  const aktivni = data.wallets.filter(w => !w.archived);
  const vychozi: HodnotyPresunu = {
    z: z ?? aktivni[0]?.id ?? '', do: aktivni.find(w => w.id !== (z ?? aktivni[0]?.id))?.id ?? '',
    castka: '', castkaCil: '', datum: dnes(), poznamka: '',
  };
  const [h, setH] = useState<HodnotyPresunu>(vychozi);
  const [koncept, setKoncept] = useState<Koncept<HodnotyPresunu> | null>(null);
  const [chyba, setChyba] = useState<ChybaPresunu>(null);
  const [chybaUlozeni, setChybaUlozeni] = useState(false);
  const zmeneno = useRef(false);

  useEffect(() => {
    void nactiKoncept<HodnotyPresunu>(KLIC).then(k => { if (k && (k.hodnota.castka || k.hodnota.poznamka)) setKoncept(k); });
  }, []);
  useEffect(() => {
    if (!zmeneno.current) return;
    const id = setTimeout(() => void ulozKoncept(KLIC, h), 400);
    return () => clearTimeout(id);
  }, [h]);

  function zmen<K extends keyof HodnotyPresunu>(pole: K, v: HodnotyPresunu[K]) {
    zmeneno.current = true; setChyba(null);
    setH(p => ({ ...p, [pole]: v }));
  }

  const ruzne = ruzneMeny(h.z, h.do, data.wallets);
  const zadani = () => ({
    z: h.z, do: h.do, castka: parseCastka(h.castka), datum: h.datum, poznamka: h.poznamka,
    ...(ruzne ? { castkaCil: parseCastka(h.castkaCil) } : {}),
  });

  async function ulozit(e: FormEvent) {
    e.preventDefault();
    const zd = zadani();
    const c = zkontrolovatPresun(zd, data.wallets);
    if (c) { setChyba(c); return; }
    const [o, p] = vytvorPresun(zd, data.wallets, {
      odchozi: cil => t('presun.nazevOdchozi', { nazev: cil }),
      prichozi: zdroj => t('presun.nazevPrichozi', { nazev: zdroj }),
      poznamka: t('presun.vychoziPoznamka'),
    }, Date.now());
    try {
      await pridatTransakci(o);
      await pridatTransakci(p);
    } catch { setChybaUlozeni(true); return; }
    await smazatKoncept(KLIC);
    onHotovo();
  }

  const volby = aktivni.map(w => <option key={w.id} value={w.id}>{w.name} ({w.currency || 'CZK'})</option>);

  return (
    <form className="sloupec" onSubmit={ulozit} noValidate>
      <h2>{t('presun.titulek')}</h2>
      {koncept && (
        <div className="karta upozorneni">
          <p>{t('presun.koncept', { cas: formatCasRelativne(koncept.cas, jazyk) })}</p>
          <div className="akce">
            <button type="button" onClick={() => { zmeneno.current = true; setH(koncept.hodnota); setKoncept(null); }}>{t('formular.pokracovat')}</button>
            <button type="button" className="vedlejsi" onClick={() => { void smazatKoncept(KLIC); setKoncept(null); }}>{t('formular.zahodit')}</button>
          </div>
        </div>
      )}
      <section className="karta">
        <label>{t('presun.z')}<select value={h.z} onChange={e => zmen('z', e.target.value)}>{volby}</select></label>
        <label>{t('presun.do')}<select value={h.do} onChange={e => zmen('do', e.target.value)} aria-invalid={chyba === 'stejne'}>{volby}</select></label>
        {chyba === 'stejne' && <p className="chyba" role="alert">{t('presun.chybaStejne')}</p>}
        {chyba === 'penezenky' && <p className="chyba" role="alert">{t('presun.chybaPenezenky')}</p>}
        <label>
          {ruzne ? t('presun.castkaVMene', { mena: menaPenezenky(h.z, data.wallets) }) : t('formular.castka')}
          <input className="velka-castka" inputMode="decimal" autoComplete="off" value={h.castka} onChange={e => zmen('castka', e.target.value)} aria-invalid={chyba === 'castka'} />
        </label>
        {chyba === 'castka' && <p className="chyba" role="alert">{t('formular.chybaCastka')}</p>}
        {ruzne && (
          <>
            <label>
              {t('presun.castkaCil', { mena: menaPenezenky(h.do, data.wallets) })}
              <input inputMode="decimal" autoComplete="off" value={h.castkaCil} onChange={e => zmen('castkaCil', e.target.value)} aria-invalid={chyba === 'castkaCil'} />
            </label>
            <p className="male tlumene">{t('presun.ruzneMenyPopis')}</p>
            {chyba === 'castkaCil' && <p className="chyba" role="alert">{t('presun.chybaCastkaCil')}</p>}
          </>
        )}
        <label>{t('formular.datum')}<input type="date" value={h.datum} onChange={e => zmen('datum', e.target.value)} aria-invalid={chyba === 'datum'} /></label>
        {chyba === 'datum' && <p className="chyba" role="alert">{t('formular.chybaDatum')}</p>}
        <label>{t('formular.poznamka')}<textarea rows={2} value={h.poznamka} onChange={e => zmen('poznamka', e.target.value)} /></label>
      </section>
      <p className="male tlumene">{t('presun.vysvetleni')}</p>
      {chybaUlozeni && <p className="chyba" role="alert">{t('formular.chybaUlozeni')}</p>}
      <button className="hlavni" type="submit">{t('presun.provest')}</button>
      <button type="button" className="vedlejsi" onClick={() => { void smazatKoncept(KLIC); onHotovo(); }}>{t('formular.zrusit')}</button>
    </form>
  );
}

/**
 * Detail přesunu (obě strany). Jednu stranu samostatně upravit nejde – rozbil by se pár
 * a zůstatky. Smazání smaže obě strany a nabídne „Zpět“.
 */
export function DetailPresunu({ transferId, onHotovo, onSmazano }: { transferId: string; onHotovo: () => void; onSmazano: (puvodni: Tx[]) => void }) {
  const { t, i18n } = useTranslation();
  const jazyk = i18n.language as KodJazyka;
  const { data } = useSklad();
  const par = data.transactions.filter(tx => tx.transferId === transferId);
  const o = par.find(tx => tx.type === 'expense');
  const p = par.find(tx => tx.type === 'income');
  const nazev = (id?: string) => data.wallets.find(w => w.id === id)?.name ?? '—';

  async function smazat() {
    const puvodni: Tx[] = [];
    for (const tx of par) { const x = await smazatTransakci(tx.id); if (x) puvodni.push(x); }
    onSmazano(puvodni);
    onHotovo();
  }

  if (!par.length) return <p className="karta tlumene">{t('presun.nenalezen')}</p>;
  return (
    <div className="sloupec">
      <h2>{t('presun.detail')}</h2>
      <section className="karta">
        {o && (
          <div className="radek">
            <span><span className="tlumene male">{t('presun.z')}</span><br /><span className="nazev">{nazev(o.wallet)}</span></span>
            <Castka castka={Number(o.amount || o.amt || 0)} mena={menaPenezenky(o.wallet ?? '', data.wallets)} typ="expense" />
          </div>
        )}
        {p && (
          <div className="radek" style={{ marginTop: 12 }}>
            <span><span className="tlumene male">{t('presun.do')}</span><br /><span className="nazev">{nazev(p.wallet)}</span></span>
            <Castka castka={Number(p.amount || p.amt || 0)} mena={menaPenezenky(p.wallet ?? '', data.wallets)} typ="income" />
          </div>
        )}
        <p className="male tlumene" style={{ marginTop: 12 }}>
          {formatDatum(String((o ?? p)?.date ?? '').slice(0, 10), jazyk)}{(o ?? p)?.note ? ` · ${(o ?? p)?.note}` : ''}
        </p>
        {par.length === 1 && <p className="male varovani">{t('presun.jenJednaStrana')}</p>}
      </section>
      <p className="male tlumene">{t('presun.upravaNaWebu')}</p>
      <div className="akce">
        <button type="button" className="vedlejsi" onClick={onHotovo}>{t('presun.zavrit')}</button>
        <button type="button" className="vedlejsi nebezpecne" onClick={() => void smazat()}>{t('presun.smazat')}</button>
      </div>
    </div>
  );
}
