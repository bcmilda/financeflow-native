import i18next, { type i18n } from 'i18next';
import ICU from 'i18next-icu';
import cs from '../locales/cs.json';
import de from '../locales/de.json';
import en from '../locales/en.json';
import pl from '../locales/pl.json';
import sk from '../locales/sk.json';
import uk from '../locales/uk.json';

/**
 * Seznam jazyků rozhraní.
 *
 * NOVÝ JAZYK:
 *   1. zkopíruj locales/cs.json → locales/<kod>.json a přelož hodnoty (klíče neměň),
 *   2. přidej import nahoře a řádek sem,
 *   3. `npm run kontrola` ověří, že nechybí žádný klíč a že množná čísla mají
 *      všechny tvary, které daný jazyk potřebuje (uk/pl/cs/sk mají 4, en/de 2).
 */
export const JAZYKY = [
  { kod: 'cs', nazev: 'Čeština', locale: 'cs-CZ', zdroj: cs },
  { kod: 'en', nazev: 'English', locale: 'en-GB', zdroj: en },
  { kod: 'sk', nazev: 'Slovenčina', locale: 'sk-SK', zdroj: sk },
  { kod: 'pl', nazev: 'Polski', locale: 'pl-PL', zdroj: pl },
  { kod: 'de', nazev: 'Deutsch', locale: 'de-DE', zdroj: de },
  { kod: 'uk', nazev: 'Українська', locale: 'uk-UA', zdroj: uk },
] as const;

export type KodJazyka = (typeof JAZYKY)[number]['kod'];
export const VYCHOZI_JAZYK: KodJazyka = 'cs';

/**
 * Země (regionální balíček) je oddělená od jazyka: daně, odvody, svátky, banky.
 * Ukrajinec v Česku má appku ukrajinsky a banky i daně české.
 */
export const REGIONY = [{ kod: 'CZ', mena: 'CZK', casovaZona: 'Europe/Prague' }] as const;
export type KodRegionu = (typeof REGIONY)[number]['kod'];

export function jeJazyk(kod: string): kod is KodJazyka {
  return JAZYKY.some(j => j.kod === kod);
}

/** Jazyk zařízení, pokud ho umíme, jinak čeština. */
export function jazykZarizeni(seznam: readonly string[] = typeof navigator !== 'undefined' ? navigator.languages : []): KodJazyka {
  for (const l of seznam) {
    const kod = l.slice(0, 2).toLowerCase();
    if (jeJazyk(kod)) return kod;
  }
  return VYCHOZI_JAZYK;
}

export function localePro(kod: KodJazyka): string {
  return JAZYKY.find(j => j.kod === kod)?.locale ?? 'cs-CZ';
}

export async function vytvorI18n(jazyk: KodJazyka): Promise<i18n> {
  const inst = i18next.createInstance();
  await inst.use(ICU).init({
    lng: jazyk,
    fallbackLng: VYCHOZI_JAZYK,
    resources: Object.fromEntries(JAZYKY.map(j => [j.kod, { translation: j.zdroj }])),
    interpolation: { escapeValue: false },
    returnNull: false,
  });
  return inst;
}

// ── Formátování: vždy přes Intl, nikdy ručně (toFixed().replace('.', ',')) ──

export function formatCastka(castka: number, mena: string, jazyk: KodJazyka): string {
  // Celé částky bez haléřů (25 000 Kč), ostatní vždy na dvě místa (145,40 Kč, ne 145,4 Kč).
  const mista = Number.isInteger(castka) ? 0 : 2;
  return new Intl.NumberFormat(localePro(jazyk), {
    style: 'currency', currency: mena, minimumFractionDigits: mista, maximumFractionDigits: mista,
  }).format(castka);
}

export function formatDatum(isoDatum: string, jazyk: KodJazyka): string {
  return new Intl.DateTimeFormat(localePro(jazyk), { day: 'numeric', month: 'numeric', year: 'numeric' })
    .format(new Date(`${isoDatum}T12:00:00`));
}

export function formatCasRelativne(cas: number, jazyk: KodJazyka, ted = Date.now()): string {
  const f = new Intl.RelativeTimeFormat(localePro(jazyk), { numeric: 'auto' });
  const min = Math.round((cas - ted) / 60_000);
  if (Math.abs(min) < 60) return f.format(min, 'minute');
  const hod = Math.round(min / 60);
  if (Math.abs(hod) < 24) return f.format(hod, 'hour');
  return f.format(Math.round(hod / 24), 'day');
}
