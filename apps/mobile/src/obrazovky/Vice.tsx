import { useTranslation } from 'react-i18next';

export type PolozkaVice = 'penezenky' | 'kategorie' | 'pujcky' | 'nastaveni';
const POLOZKY: { klic: PolozkaVice; ikona: string }[] = [
  { klic: 'penezenky', ikona: '👛' },
  { klic: 'kategorie', ikona: '🗂️' },
  { klic: 'pujcky', ikona: '🏦' },
  { klic: 'nastaveni', ikona: '⚙️' },
];

/** Záložka „Více“ – rozcestník dalších obrazovek klonu webu. */
export function Vice({ onOtevrit }: { onOtevrit: (p: PolozkaVice) => void }) {
  const { t } = useTranslation();
  return (
    <div className="sloupec">
      <h2>{t('app.nav.vice')}</h2>
      <section className="karta">
        <ul className="seznam">
          {POLOZKY.map(p => (
            <li key={p.klic}>
              <button className="tx-radek" onClick={() => onOtevrit(p.klic)}>
                <span className="tx-ikona" aria-hidden="true">{p.ikona}</span>
                <span className="tx-info">
                  <span className="nazev">{t(`vice.${p.klic}`)}</span>
                  <span className="male tlumene">{t(`vice.${p.klic}Popis`)}</span>
                </span>
                <span className="tlumene" aria-hidden="true">›</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
