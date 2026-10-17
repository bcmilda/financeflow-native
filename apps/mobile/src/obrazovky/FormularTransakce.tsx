import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { Tx } from '@ff/core';
import { formatCasRelativne, type KodJazyka } from '@ff/i18n';
import {
  kategorieProTyp, novaTransakce, prazdnyFormular, validovat, zmenyTransakce, zTransakce,
  type ChybaFormulare, type HodnotyFormulare,
} from '../data/formular-transakce';
import { nactiKoncept, smazatKoncept, ulozKoncept, type Koncept } from '../data/koncepty';
import { noveIdTx, pridatTransakci, smazatTransakci, upravitTransakci, useSklad } from '../data/sklad';

function dnes(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Přidání a úprava transakce.
 *
 * - Rozepsaný stav se průběžně ukládá do zařízení (koncept). Odchod z obrazovky,
 *   zavření appky ani pád nic nesmaže – příště se nabídne „Pokračovat“.
 * - Úprava zapíše jen změněná pole (zbytek transakce zůstane, jak ho uložil web).
 * - Smazání bez dotazu „Opravdu?“ – místo toho „Zpět“ v oznámení dole.
 */
export function FormularTransakce({ tx, onHotovo, onSmazano }: {
  tx: Tx | null;
  onHotovo: () => void;
  onSmazano: (puvodni: Tx) => void;
}) {
  const { t, i18n } = useTranslation();
  const jazyk = i18n.language as KodJazyka;
  const { data } = useSklad();
  const klicKonceptu = `tx:${tx ? String(tx.id) : 'nova'}`;
  const vychozi = useMemo<HodnotyFormulare>(
    () => (tx ? zTransakce(tx) : prazdnyFormular(dnes(), data.wallets.find(w => !w.archived)?.id ?? '')),
    // Výchozí stav jen při otevření (podle id) – živé změny dat rozepsaný formulář nepřepisují.
    [tx?.id],
  );
  const [h, setH] = useState<HodnotyFormulare>(vychozi);
  const [koncept, setKoncept] = useState<Koncept<HodnotyFormulare> | null>(null);
  const [chyba, setChyba] = useState<ChybaFormulare>(null);
  const [chybaUlozeni, setChybaUlozeni] = useState(false);
  const zmeneno = useRef(false);

  // Nabídnout dříve rozepsaný stav (jen když se liší od výchozího).
  useEffect(() => {
    void nactiKoncept<HodnotyFormulare>(klicKonceptu).then(k => {
      if (k && JSON.stringify(k.hodnota) !== JSON.stringify(vychozi)) setKoncept(k);
    });
  }, [klicKonceptu, vychozi]);

  // Průběžné ukládání konceptu (po změně uživatelem, s krátkým zpožděním).
  useEffect(() => {
    if (!zmeneno.current) return;
    const id = setTimeout(() => void ulozKoncept(klicKonceptu, h), 400);
    return () => clearTimeout(id);
  }, [h, klicKonceptu]);

  function zmen<K extends keyof HodnotyFormulare>(pole: K, hodnota: HodnotyFormulare[K]) {
    zmeneno.current = true;
    setChyba(null);
    setH(prev => {
      const n = { ...prev, [pole]: hodnota };
      // Jiný typ → kategorie nemusí pasovat; jiná kategorie → podkategorie neplatí.
      if (pole === 'typ' && !kategorieProTyp(data.categories, hodnota as HodnotyFormulare['typ']).some(c => c.id === n.catId)) n.catId = '';
      if (pole === 'catId' || (pole === 'typ' && n.catId !== prev.catId)) n.subcat = '';
      return n;
    });
  }

  const nabidka = kategorieProTyp(data.categories, h.typ);
  // Upravovaná transakce může mít kategorii mimo nabídku (archivovanou) – nechat ji ve výběru.
  const vybrana = data.categories.find(c => c.id === h.catId);
  const kategorie = vybrana && !nabidka.includes(vybrana) ? [vybrana, ...nabidka] : nabidka;
  const podkategorie = vybrana?.subs ?? [];
  const penezenky = data.wallets.filter(w => !w.archived || w.id === h.wallet);

  async function ulozit(e: FormEvent) {
    e.preventDefault();
    const c = validovat(h, data.categories);
    if (c) { setChyba(c); return; }
    try {
      if (tx) await upravitTransakci(tx.id, zmenyTransakce(tx, h, data.categories, data.wallets));
      else await pridatTransakci(novaTransakce(h, data.categories, data.wallets, noveIdTx(), Date.now()));
    } catch {
      // Koncept zůstává uložený – nic se neztratí.
      setChybaUlozeni(true);
      return;
    }
    await smazatKoncept(klicKonceptu);
    onHotovo();
  }

  async function zrusit() {
    await smazatKoncept(klicKonceptu);
    onHotovo();
  }

  async function smazat() {
    if (!tx) return;
    await smazatKoncept(klicKonceptu);
    const puvodni = await smazatTransakci(tx.id);
    if (puvodni) onSmazano(puvodni);
    onHotovo();
  }

  return (
    <form className="sloupec" onSubmit={ulozit} noValidate>
      <h2>{tx ? t('formular.upravit') : t('formular.novy')}</h2>

      {koncept && (
        <div className="karta upozorneni">
          <p>{t('formular.koncept', { cas: formatCasRelativne(koncept.cas, jazyk) })}</p>
          <div className="akce">
            <button type="button" onClick={() => { zmeneno.current = true; setH(koncept.hodnota); setKoncept(null); }}>{t('formular.pokracovat')}</button>
            <button type="button" className="vedlejsi" onClick={() => { void smazatKoncept(klicKonceptu); setKoncept(null); }}>{t('formular.zahodit')}</button>
          </div>
        </div>
      )}

      {tx?.zdroj === 'notifikace' && <p className="male tlumene">{t('formular.zNotifikace')}</p>}

      <div className="prepinac-typu" role="group">
        <button type="button" className={h.typ === 'expense' ? 'aktivni vydaj' : ''} aria-pressed={h.typ === 'expense'} onClick={() => zmen('typ', 'expense')}>{t('formular.vydaj')}</button>
        <button type="button" className={h.typ === 'income' ? 'aktivni prijem' : ''} aria-pressed={h.typ === 'income'} onClick={() => zmen('typ', 'income')}>{t('formular.prijem')}</button>
      </div>

      <section className="karta">
        <label>
          {t('formular.castka')}
          <input className="velka-castka" inputMode="decimal" autoComplete="off" value={h.castka} onChange={e => zmen('castka', e.target.value)}
            aria-invalid={chyba === 'castka'} autoFocus={!tx} />
        </label>
        {chyba === 'castka' && <p className="chyba" role="alert">{t('formular.chybaCastka')}</p>}
        <label>
          {t('formular.nazev')}
          <input value={h.nazev} onChange={e => zmen('nazev', e.target.value)} aria-invalid={chyba === 'nazev'} />
        </label>
        <label>
          {t('formular.kategorie')}
          <select value={h.catId} onChange={e => zmen('catId', e.target.value)}>
            <option value="">{t('kategorie.bez')}</option>
            {kategorie.map(c => <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ''}{c.name}</option>)}
          </select>
        </label>
        {chyba === 'nazev' && <p className="chyba" role="alert">{t('formular.chybaNazev')}</p>}
        {podkategorie.length > 0 && (
          <label>
            {t('formular.podkategorie')}
            <select value={h.subcat} onChange={e => zmen('subcat', e.target.value)}>
              <option value="">{t('formular.nevybrano')}</option>
              {podkategorie.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        )}
        <label>
          {t('formular.datum')}
          <input type="date" value={h.datum} onChange={e => zmen('datum', e.target.value)} aria-invalid={chyba === 'datum'} />
        </label>
        {chyba === 'datum' && <p className="chyba" role="alert">{t('formular.chybaDatum')}</p>}
        <label>
          {t('formular.penezenka')}
          <select value={h.wallet} onChange={e => zmen('wallet', e.target.value)}>
            <option value="">{t('formular.bezPenezenky')}</option>
            {penezenky.map(w => <option key={w.id} value={w.id}>{w.name}{w.currency && w.currency !== 'CZK' ? ` (${w.currency})` : ''}</option>)}
          </select>
        </label>
        <label>
          {t('formular.poznamka')}
          <textarea rows={2} value={h.poznamka} onChange={e => zmen('poznamka', e.target.value)} />
        </label>
      </section>

      {chybaUlozeni && <p className="chyba" role="alert">{t('formular.chybaUlozeni')}</p>}
      <button className="hlavni" type="submit">{t('formular.ulozit')}</button>
      <div className="akce">
        <button type="button" className="vedlejsi" onClick={() => void zrusit()}>{t('formular.zrusit')}</button>
        {tx && <button type="button" className="vedlejsi nebezpecne" onClick={() => void smazat()}>{t('formular.smazat')}</button>}
      </div>
    </form>
  );
}
