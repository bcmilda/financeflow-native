# FinanceFlow Native – pokyny pro Claude

Pracovní jazyk: čeština. Milan není programátor, rozhoduje o produktu a architektuře, Claude implementuje.

## Na začátku sezení
1. Tento soubor, `doc/ROZHODNUTI.md`, `doc/ARCHITEKTURA.md`, plán aktuální session (`doc/PLAN-SESSION-N*.md`, nejvyšší číslo) a podle úkolu `doc/BANKY.md`, `doc/JAZYKY.md`, `doc/PARITA.md`.
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

---

## Session N1 (17. 10. 2026) · n0.1 → n0.2

Shrnutí v `doc/SESSION-N1.md`, další kroky v `doc/PLAN-SESSION-N2.md`.

- **Klon webu (N-009):** obrazovky a výpočty podle webu. Nový výpočet = přenést z webu do `packages/core` + rozšířit kontraktní test (`packages/core/test/kontrakt-web.test.ts`). Odchylka od webu jen vědomě a zapsaná v `doc/ROZHODNUTI.md` (N-108).
- **Žádný odhad kategorie z oznámení (N-008).**
- **Zápis dat jen přes `data/sklad.ts`** (`pridatTransakci`, `upravitTransakci`, `smazatTransakci`) – jde přes frontu v zařízení a promítne se hned. Nikdy `set` na celé `data` ani na sekce, které web ukládá jako celé pole (`wallets`, `categories`, `debts`…), dokud není vyřešené bezpečné slučování.
- **Nová obrazovka:** texty jen přes `t()`, klíče do všech 6 `locales/*.json` (`npm run kontrola`); formulář = koncept v zařízení (`data/koncepty.ts`); ověřit v Chromiu na šířce 360 a 390 px a aspoň v jednom dalším jazyce (uk má nejdelší texty).
- **Náhled bez Firebase:** `naplnitProNahled(data)` v `data/sklad.ts` naplní sklad testovacími daty. Firebase pro náhled se podvrhne pluginem ve Vite (konfiguraci držet mimo repo nebo smazat před commitem).
- **Android kód** (`android/app/src/main/java/cz/financeflow/nativni/`) zatím neprošel skutečným buildem – první build v CI ověřit jako úplně první krok N2.
- Repo zatím není na GitHubu; poslední stav je v zipu `financeflow-native-n0.2.zip` (včetně historie git).

---

## Session N2 (24. 10. 2026) · n0.2 → n0.3

Shrnutí v `doc/SESSION-N2.md`, další kroky v `doc/PLAN-SESSION-N3.md`. Repo stále není na GitHubu – blok A (telefon) se přesunul do N3.

- **Nová obrazovka klonu** = položka ve „Více“ (`obrazovky/Vice.tsx`) + větev v `App.tsx` (`Podstranka` / `Prekryv`), Zpět o úroveň výš.
- **Přesuny:** `vytvorPresun` v core, zápis dvou transakcí přes `pridatTransakci`. Transakci s `transferId` otevírat jako `DetailPresunu`, nikdy ve formuláři transakce.
- **Peněženky, kategorie, půjčky jen čtení (N-111)** – web je ukládá jako celá pole.
- **Web se mezi sessions mění** (N1 v11.77 → N2 v12.04). Na začátku session: `git fetch` webu, `git diff` výpočtových souborů, `npm run vse` (kontraktní test).
- **Náhled bez Firebase:** testovací data a konfigurace Vite v scratchpadu (`nahled.tsx`, `vite.nahled.config.ts`, podvržený `firebase.ts`) – do appky kopírovat jen na dobu proklikání a před commitem smazat.

---

## Repo a CI (od 26. 10. 2026)

- Repo `bcmilda/financeflow-native`, větev `main`. Push ze session funguje (Claude GitHub App má přístup).
- Každý push do `main`: kontroly + testy (kontraktní test s webem povinný) + Android build. APK v Releases `prubezne`: https://github.com/bcmilda/financeflow-native/releases/tag/prubezne
- Logy a artefakty GitHub Actions odsud stáhnout nejde (proxy) – stav kroků přes `gh api repos/bcmilda/financeflow-native/actions/jobs/<id>`.
- Zip archivy (`financeflow-native-n0.x.zip`) už nejsou potřeba.

