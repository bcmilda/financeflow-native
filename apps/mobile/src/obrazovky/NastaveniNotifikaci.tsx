import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { App as CapApp } from '@capacitor/app';
import { BANKY } from '@ff/core';
import { nactiPenezenky, type Penezenka } from '../firebase';
import { BankovniNotifikace, type StavCteni } from '../notifikace/plugin';
import { nactiHistorii, nactiNastaveni, ulozNastaveni, type Nastaveni } from '../uloziste';

export function NastaveniNotifikaci({ uid, onHotovo }: { uid: string; onHotovo: () => void }) {
  const { t } = useTranslation();
  const [n, setN] = useState<Nastaveni | null>(null);
  const [stav, setStav] = useState<StavCteni | null>(null);
  const [penezenky, setPenezenky] = useState<Penezenka[]>([]);
  const [karty, setKarty] = useState<{ banka: string; karta4: string }[]>([]);

  const obnovitStav = useCallback(async () => setStav(await BankovniNotifikace.stav()), []);

  useEffect(() => {
    void (async () => {
      setN(await nactiNastaveni());
      await obnovitStav();
      setPenezenky(await nactiPenezenky(uid).catch(() => []));
      // Karty, které už se v oznámeních objevily → lze jim přiřadit vlastní peněženku (např. kreditka).
      const videne = new Map<string, { banka: string; karta4: string }>();
      for (const h of await nactiHistorii()) if (h.karta4) videne.set(`${h.banka}:${h.karta4}`, { banka: h.banka, karta4: h.karta4 });
      setKarty([...videne.values()]);
    })();
    // Po návratu z nastavení telefonu znovu zjistit, jestli uživatel přístup povolil.
    const p = CapApp.addListener('resume', () => void obnovitStav());
    return () => { void p.then(h => h.remove()); };
  }, [uid, obnovitStav]);

  async function zmenit(zmena: Partial<Nastaveni>) {
    if (!n) return;
    const nove = { ...n, ...zmena };
    setN(nove);
    await ulozNastaveni(nove);
    if (zmena.balicky) await BankovniNotifikace.nastavitBanky({ balicky: nove.balicky });
  }

  if (!n) return <div className="stred">{t('app.nacitam')}</div>;

  if (!n.souhlasNotifikace) {
    return (
      <section className="karta">
        <h2>{t('notifikace.upozorneniNadpis')}</h2>
        <ul className="body">
          <li>{t('notifikace.upozorneniBod1')}</li>
          <li>{t('notifikace.upozorneniBod2')}</li>
          <li>{t('notifikace.upozorneniBod3')}</li>
          <li>{t('notifikace.upozorneniBod4')}</li>
        </ul>
        <button className="hlavni" onClick={() => void zmenit({ souhlasNotifikace: true })}>{t('notifikace.souhlas')}</button>
      </section>
    );
  }

  const balickyBanky = (id: string) => BANKY.find(b => b.id === id)?.aplikace.map(a => a.balicek) ?? [];
  const jeVybrana = (id: string) => balickyBanky(id).some(b => n.balicky.includes(b));
  function prepnoutBanku(id: string, zapnout: boolean) {
    const jeho = balickyBanky(id);
    const balicky = zapnout ? [...new Set([...n!.balicky, ...jeho])] : n!.balicky.filter(b => !jeho.includes(b));
    void zmenit({ balicky });
  }
  function nastavitPenezenku(klic: string, id: string) {
    const penezenky = { ...n!.penezenky };
    if (id) penezenky[klic] = id; else delete penezenky[klic];
    void zmenit({ penezenky });
  }

  return (
    <div className="sloupec">
      <h2>{t('notifikace.titulek')}</h2>

      <section className={`karta krok ${stav?.pristup ? 'splneno' : ''}`}>
        <h3>{t('notifikace.krokPristup')}</h3>
        <p className="tlumene male">{t('notifikace.krokPristupPopis')}</p>
        <button onClick={() => void BankovniNotifikace.otevritPristup()}>{t('notifikace.otevritNastaveni')}</button>
      </section>

      <section className={`karta krok ${stav?.baterie ? 'splneno' : ''}`}>
        <h3>{t('notifikace.krokBaterie')}</h3>
        <p className="tlumene male">{t('notifikace.krokBateriePopis')}</p>
        <button onClick={() => void BankovniNotifikace.otevritBaterii()}>{t('notifikace.otevritNastaveni')}</button>
      </section>

      <section className="karta">
        <h3>{t('notifikace.krokBanky')}</h3>
        <ul className="seznam">
          {BANKY.map(b => (
            <li key={b.id} className="polozka">
              <label className="prepinac">
                <input type="checkbox" checked={jeVybrana(b.id)} onChange={e => prepnoutBanku(b.id, e.target.checked)} />
                <span>{b.nazev}</span>
                {!b.pravidlaOverena && <span className="stitek">{t('notifikace.neovereno')}</span>}
              </label>
              {jeVybrana(b.id) && (
                <VyberPenezenky
                  popisek={t('notifikace.penezenka')} prazdna={t('notifikace.zadnaPenezenka')} penezenky={penezenky}
                  hodnota={n.penezenky[b.id] ?? ''} onZmena={id => nastavitPenezenku(b.id, id)}
                />
              )}
              {karty.filter(k => k.banka === b.id).map(k => (
                <VyberPenezenky
                  key={k.karta4} popisek={t('notifikace.karta', { karta4: k.karta4 })} prazdna={t('notifikace.zadnaPenezenka')}
                  penezenky={penezenky} hodnota={n.penezenky[`${b.id}:${k.karta4}`] ?? ''}
                  onZmena={id => nastavitPenezenku(`${b.id}:${k.karta4}`, id)}
                />
              ))}
            </li>
          ))}
        </ul>
      </section>

      <Pruzkum n={n} onPriradit={(balicek, banka) => void zmenit({
        vlastniBalicky: { ...n.vlastniBalicky, [balicek]: banka },
        balicky: [...new Set([...n.balicky, balicek])],
      })} />

      <button className="hlavni" onClick={onHotovo}>{t('notifikace.hotovo')}</button>
    </div>
  );
}

function VyberPenezenky(p: { popisek: string; prazdna: string; penezenky: Penezenka[]; hodnota: string; onZmena: (id: string) => void }) {
  return (
    <label className="male">
      {p.popisek}
      <select value={p.hodnota} onChange={e => p.onZmena(e.target.value)}>
        <option value="">{p.prazdna}</option>
        {p.penezenky.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
      </select>
    </label>
  );
}

/** Najde balíček aplikace banky, kterou katalog nezná (nebo zná pod jiným balíčkem). */
function Pruzkum({ n, onPriradit }: { n: Nastaveni; onPriradit: (balicek: string, banka: string) => void }) {
  const { t } = useTranslation();
  const [vysledek, setVysledek] = useState<{ do: number; aplikace: { balicek: string; nazev: string }[] }>({ do: 0, aplikace: [] });
  const [ted, setTed] = useState(Date.now());

  useEffect(() => {
    const obnov = async () => { setVysledek(await BankovniNotifikace.vysledekPruzkumu()); setTed(Date.now()); };
    void obnov();
    const id = window.setInterval(() => void obnov(), 5000);
    return () => window.clearInterval(id);
  }, []);

  const bezi = vysledek.do > ted;
  const zbyva = Math.max(1, Math.ceil((vysledek.do - ted) / 60_000));

  return (
    <section className="karta">
      <h3>{t('notifikace.pruzkumNadpis')}</h3>
      <p className="tlumene male">{t('notifikace.pruzkumPopis')}</p>
      {bezi
        ? <p className="male">{t('notifikace.pruzkumBezi', { minut: zbyva })}</p>
        : <button onClick={() => void BankovniNotifikace.spustitPruzkum({ minut: 5 }).then(() => setVysledek({ do: Date.now() + 300_000, aplikace: [] }))}>{t('notifikace.pruzkumSpustit')}</button>}
      {vysledek.aplikace.length > 0 && (
        <>
          <h4>{t('notifikace.pruzkumNalezeno')}</h4>
          <ul className="seznam">
            {vysledek.aplikace.map(a => (
              <li key={a.balicek} className="polozka">
                <div className="male"><strong>{a.nazev}</strong> <span className="tlumene">{a.balicek}</span></div>
                <label className="male">
                  {t('notifikace.priradit')}
                  <select value={n.vlastniBalicky[a.balicek] ?? ''} onChange={e => e.target.value && onPriradit(a.balicek, e.target.value)}>
                    <option value="">–</option>
                    {BANKY.map(b => <option key={b.id} value={b.id}>{b.nazev}</option>)}
                  </select>
                </label>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
