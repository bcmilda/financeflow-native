# Architektura

Stav: **n0.2** (Session N1, 17. 10. 2026).

## Přehled

```
┌──────────────── telefon (Android) ────────────────┐        ┌──── Firebase financeflow-a249c ────┐
│ BankovniNotifikaceService (Java)                  │        │ users/{uid}/data/transactions/{id} │
│   └─ fronta oznámení (SharedPreferences)          │        │ users/{uid}/data/categories        │
│ BankovniNotifikacePlugin (Java) ⇄ plugin.ts       │        │ users/{uid}/data/wallets, bank,    │
│                                                   │        │ debts …                            │
│ WebView: React appka (apps/mobile/src)            │        └──────────────▲─────────────────────┘
│   obrazovky → data/sklad.ts ──fronta zápisů──────────────────────────────┤ po jedné transakci
│                 ▲ snímek dat (IndexedDB)          │                       │
│   @ff/core (výpočty, parsery)  @ff/i18n (jazyky)  │        web financeflow.cz čte totéž
└───────────────────────────────────────────────────┘
```

## Balíčky

| Balíček | Co obsahuje | Testy |
|---|---|---|
| `packages/core` | `parsery/` oznámení bank · `schema/` tvar transakce webu (Zod) · `transakce/` transakce z oznámení, duplicity · `uctenky/` párování účtenky s platbou · `data/` výpočty z webu (příjmy, výdaje, přesuny, zůstatky) · `text/` normalizace | 68 (z toho 12 kontraktních s webem) |
| `packages/i18n` | `locales/*.json` (cs, en, sk, pl, de, uk), `vytvorI18n`, `formatCastka`, `formatDatum`, `formatCasRelativne`, `JAZYKY`, `REGIONY` | 7 |
| `apps/mobile` | React + Vite + Capacitor 8, Android projekt v `android/` | 24 |
| `tools/` | `kontrola-prekladu.mjs`, `kontrola-textu.mjs` | – |

## Appka (`apps/mobile/src`)

| Soubor | Úloha |
|---|---|
| `App.tsx` | přihlášení, záložky (Přehled, Transakce, Z banky, Nastavení), tlačítko +, „Zpět“ po smazání, systémové tlačítko Zpět, stav spojení |
| `firebase.ts` | Firebase (stejný projekt jako web), přihlášení e-mailem i Google, obnova hesla |
| `konfigurace.ts` | `GOOGLE_WEB_CLIENT_ID` (zatím prázdné – viz `doc/PRIHLASENI.md`) |
| `data/sklad.ts` | živá data: transakce po jedné (onChildAdded/Changed/Removed), kategorie, peněženky, bank, dluhy; snímek v IndexedDB; `pridatTransakci`, `upravitTransakci` (jen změněná pole), `smazatTransakci`; `useSklad()` |
| `data/fronta-zapisu.ts` | zápisy uložené v zařízení, smažou se po potvrzení serverem, po restartu se pošlou znovu |
| `data/koncepty.ts` | rozepsané formuláře (Preferences) |
| `data/formular-transakce.ts` | logika formuláře: nová transakce, změněná pole, kontrola |
| `komponenty/spolecne.tsx` | výběr měsíce, částka, kategorie pro zobrazení, hledání, řazení |
| `obrazovky/` | `Prihlaseni`, `Prehled`, `Transakce`, `FormularTransakce`, `ZBanky`, `NastaveniNotifikaci`, `Nastaveni` |
| `notifikace/` | `plugin.ts` (most k Javě), `zpracovani.ts` (fronta → transakce), `sluzba.ts` (spouštění, zámek) |
| `uloziste.ts` | nastavení appky a historie oznámení v telefonu |

## Tok oznámení z banky

1. Android zavolá `BankovniNotifikaceService.onNotificationPosted`.
2. Oznámení aplikace, kterou uživatel nevybral → zahodit (během průzkumu jen zapsat název aplikace).
3. Vybraná banka → `Fronta.pridej` (titulek, rozbalený text, čas, balíček; dvojí doručení se pozná).
4. Appka běží → událost `notifikace`; jinak při dalším otevření / návratu do appky.
5. `zpracujPolozky`: parser → `ignorovat` (budoucí splátka, ověření…) / `nerozpoznáno` (text zůstane jen v telefonu) / `platba`.
6. Platba v CZK, bez dvojčete → `vytvorTransakci` (id z notifikace, bez kategorie, peněženka podle banky nebo karty) → zápis `transactions/{id}`.
7. Až po zápisu se položka potvrdí a smaže z fronty v telefonu.

## Pravidla dat (shoda s webem)

- Zápis vždy jen `users/{uid}/data/transactions/{id}` (celá nová transakce) nebo update jejích polí. Nikdy celé `data` ani jiné sekce.
- Tvar transakce viz `packages/core/src/schema/transakce.ts` a `data/typy.ts`. Web čte `amount || amt`.
- Výpočty v `packages/core/src/data/vypocty.ts` odpovídají webu (helpers.js, premium.js @ v11.77). Kontraktní test to hlídá.

## Kontroly (`npm run vse`, totéž v CI)

1. překlady (klíče, ICU, množná čísla, proměnné),
2. žádný text natvrdo v komponentách,
3. TypeScript strict,
4. testy (99, z toho 12 kontraktních – v CI se web stáhne vedle),
5. build. Android APK staví CI (`.github/workflows/ci.yml`).

## Android

- Balíček `cz.financeflow.nativni`, minSdk 24, target 36, Capacitor 8.5.
- Nativní kód: `android/app/src/main/java/cz/financeflow/nativni/` (`MainActivity`, `BankovniNotifikaceService`, `BankovniNotifikacePlugin`, `Fronta`).
- Debug podpis pevným klíčem `android/app/debug.keystore` (SHA-1 v `doc/PRIHLASENI.md`).
- ⚠️ Java kód zatím nikdy neprošel skutečným Android buildem (v pracovním prostředí není Android SDK). Byl zkontrolován jen překladem proti náhradám API. První build v CI to ověří.
