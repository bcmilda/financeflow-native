# FinanceFlow Native – pokyny pro Claude

Pracovní jazyk: čeština. Milan není programátor, rozhoduje o produktu a architektuře, Claude implementuje.

## Na začátku sezení
1. Tento soubor, `doc/ROZHODNUTI.md`, a podle úkolu `doc/BANKY.md`, `doc/JAZYKY.md`.
2. Webová appka (`bcmilda/financeflow`, větev `dev`, složka `doc/`) slouží jako **mapa obrazovek a výpočtů**, ne jako pravidla tohoto projektu (N-002). Výpočty (výplatnice, měřidla…) se odtud přenášejí do `packages/core` i s testy.

## Pravidla
- **Žádný text natvrdo.** Vše přes `t('klíč')` + klíč do všech `packages/i18n/locales/*.json`.
- **Data webu se nesmí rozbít.** Zápis jen po jednotlivých záznamech (`transactions/{id}`), nikdy celé `users/{uid}/data`. Tvar transakce = tvar webu (`packages/core/src/schema/transakce.ts`). Nový uzel ve Firebase = nejdřív pravidla v repu webu (`database.rules.json`).
- **Čisté výpočty patří do `packages/core`** s testy. UI jen zobrazuje.
- **Parser banky jen se skutečnými vzorky** v testu (anonymizovanými). Radši nerozpoznat než zapsat špatně.
- **Nový test musí na starém/rozbitém kódu selhat** (negativní kontrola), jinak nic nedokazuje.
- Před odevzdáním `npm run vse` (totéž dělá CI).
- U změny obrazovky uvést cestu v appce (např. „Z banky → Nastavit → Vyber své banky“).

## Verze
`n0.x` (nativní), web zůstává `v11.xx`. Verze v `apps/mobile/package.json`.
