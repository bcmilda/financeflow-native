# Jazyky

Jazyky rozhraní: **cs** (výchozí a vzor), **en**, **sk**, **pl**, **de**, **uk** – 206 klíčů (n0.3). Překlady jsou strojově připravené Claudem; před vydáním je má projít rodilý mluvčí.

## Přidat jazyk

1. Zkopírovat `packages/i18n/locales/cs.json` → `packages/i18n/locales/<kód>.json` a přeložit hodnoty. Klíče se nemění.
2. V `packages/i18n/src/index.ts` přidat import a řádek do `JAZYKY` (kód, název v daném jazyce, locale, zdroj).
3. `npm run kontrola` ověří, že:
   - nechybí ani nepřebývá žádný klíč,
   - každá zpráva je platné ICU,
   - množné číslo má všechny tvary, které jazyk potřebuje (cs/sk/pl/uk 4 tvary, en/de 2),
   - překlad používá stejné proměnné jako čeština.

## Psaní textů v kódu

- Nikdy text přímo v komponentě. Vždy `t('obrazovka.klic')` a klíč do všech `locales/*.json`. `npm run kontrola` jinak build zastaví.
- Množné číslo přes ICU: `{n, plural, one {# transakce} few {# transakce} many {# transakce} other {# transakcí}}`.
- Částky, data a časy jen přes `formatCastka`, `formatDatum`, `formatCasRelativne` (`Intl`).
- Uživatelská data (názvy kategorií, obchodníci) se nepřekládají.
