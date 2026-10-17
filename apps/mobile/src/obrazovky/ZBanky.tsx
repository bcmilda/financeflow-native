import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { App as CapApp } from '@capacitor/app';
import { BANKY, parseNotifikace } from '@ff/core';
import { formatCastka, formatCasRelativne, formatDatum, type KodJazyka } from '@ff/i18n';
import { BankovniNotifikace, type StavCteni } from '../notifikace/plugin';
import { pridatPresto, zahodit, zpracujFrontu } from '../notifikace/sluzba';
import { nactiHistorii, nactiNerozpoznane, type Nerozpoznana, type PolozkaHistorie } from '../uloziste';

export function ZBanky({ uid, onNastavit }: { uid: string; onNastavit: () => void }) {
  const { t, i18n } = useTranslation();
  const jazyk = i18n.language as KodJazyka;
  const [stav, setStav] = useState<StavCteni | null>(null);
  const [historie, setHistorie] = useState<PolozkaHistorie[]>([]);
  const [nerozpoznane, setNerozpoznane] = useState<Nerozpoznana[]>([]);

  const obnovit = useCallback(async () => {
    setStav(await BankovniNotifikace.stav());
    await zpracujFrontu(uid).catch(() => 0);
    setHistorie((await nactiHistorii()).filter(h => h.stav !== 'zahozeno'));
    setNerozpoznane(await nactiNerozpoznane());
  }, [uid]);

  useEffect(() => {
    void obnovit();
    const posluchaci = [
      BankovniNotifikace.addListener('notifikace', () => void obnovit()),
      CapApp.addListener('resume', () => void obnovit()),
    ];
    return () => { posluchaci.forEach(p => void p.then(h => h.remove())); };
  }, [obnovit]);

  const zapnuto = stav?.android && stav.pristup;

  return (
    <div className="sloupec">
      <section className={`karta stav ${zapnuto ? 'zapnuto' : ''}`}>
        <p>{!stav ? t('app.nacitam') : !stav.android ? t('zBanky.stavNeniAndroid') : zapnuto ? t('zBanky.stavZapnuto') : t('zBanky.stavVypnuto')}</p>
        {stav?.android && <button onClick={onNastavit}>{t('zBanky.nastavit')}</button>}
      </section>

      <section className="karta">
        <h2>{t('zBanky.posledni')}</h2>
        {historie.length === 0 && <p className="tlumene">{t('zBanky.prazdne')}</p>}
        <ul className="seznam">
          {historie.map(h => (
            <li key={h.klic} className={`polozka ${h.stav}`}>
              <div className="radek">
                <span className="nazev">{h.nazev}</span>
                <span className={`castka ${h.typ}`}>{h.typ === 'income' ? '+' : '−'}{formatCastka(h.castka, h.mena, jazyk)}</span>
              </div>
              <div className="radek male tlumene">
                <span>{BANKY.find(b => b.id === h.banka)?.nazev ?? h.banka}{h.karta4 ? ` •••• ${h.karta4}` : ''}</span>
                <span>{formatCasRelativne(h.cas, jazyk)}</span>
              </div>
              {h.stav === 'zapsano' && <p className="male ok">{t('zBanky.zapsano')}</p>}
              {h.stav === 'jinaMena' && <p className="male varovani">{t('zBanky.jinaMena')}</p>}
              {h.stav === 'duplicita' && (
                <div className="akce">
                  <p className="male varovani">
                    {t('zBanky.duplicita', { nazev: h.shodaNazev ?? '', datum: h.shodaDatum ? formatDatum(h.shodaDatum, jazyk) : '' })}
                  </p>
                  <button onClick={() => void pridatPresto(uid, h).then(obnovit)}>{t('zBanky.pridatPresto')}</button>
                  <button className="vedlejsi" onClick={() => void zahodit(h).then(obnovit)}>{t('zBanky.zahodit')}</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {nerozpoznane.length > 0 && (
        <section className="karta">
          <h2>{t('zBanky.nerozpoznane', { n: nerozpoznane.length })}</h2>
          <p className="tlumene male">{t('zBanky.nerozpoznanePopis')}</p>
          <ul className="seznam">
            {nerozpoznane.map(n => (
              <li key={n.id} className="polozka">
                <p className="male"><strong>{n.titulek}</strong> {n.text}</p>
                <button className="vedlejsi" onClick={() => void navigator.clipboard?.writeText(`${n.balicek}\n${n.titulek}\n${n.text}`)}>
                  {t('zBanky.kopirovat')}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <VyzkousetText />
    </div>
  );
}

/** Ruční vyzkoušení parseru – funguje i v prohlížeči a na iPhonu. Nic nezapisuje. */
function VyzkousetText() {
  const { t, i18n } = useTranslation();
  const jazyk = i18n.language as KodJazyka;
  const [banka, setBanka] = useState(BANKY[0]?.id ?? 'kb');
  const [titulek, setTitulek] = useState('');
  const [text, setText] = useState('');
  const [vysledek, setVysledek] = useState('');

  function rozpoznat() {
    const b = BANKY.find(x => x.id === banka);
    const balicek = b?.aplikace[0]?.balicek ?? '';
    const r = parseNotifikace({ balicek, titulek, text, cas: Date.now() });
    if (r.stav === 'platba') {
      setVysledek(t('zBanky.vysledekPlatba', {
        typ: r.platba.typ, castka: formatCastka(r.platba.castka, r.platba.mena, jazyk), nazev: r.platba.protistrana || '–',
      }));
    } else setVysledek(r.stav === 'ignorovat' ? t('zBanky.vysledekIgnorovat') : t('zBanky.vysledekNic'));
  }

  return (
    <section className="karta">
      <h2>{t('zBanky.zkusitTitulek')}</h2>
      <label>
        {t('zBanky.zkusitBanka')}
        <select value={banka} onChange={e => setBanka(e.target.value)}>
          {BANKY.map(b => <option key={b.id} value={b.id}>{b.nazev}</option>)}
        </select>
      </label>
      <label>
        {t('zBanky.zkusitNadpis')}
        <input value={titulek} onChange={e => setTitulek(e.target.value)} />
      </label>
      <label>
        {t('zBanky.zkusitText')}
        <textarea rows={3} value={text} onChange={e => setText(e.target.value)} />
      </label>
      <button onClick={rozpoznat} disabled={!text.trim()}>{t('zBanky.rozpoznat')}</button>
      {vysledek && <p className="vysledek" role="status">{vysledek}</p>}
    </section>
  );
}
