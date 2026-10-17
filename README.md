# FinanceFlow Native

Nová appka FinanceFlow pro telefon. Běží vedle webu [financeflow.cz](https://financeflow.cz) nad **stejným účtem a stejnými daty** (Firebase `financeflow-a249c`). Má doplnit slabiny webu a jednou ho možná nahradit.

**Co umí verze n0.2**
- Přihlášení přes Google i e-mailem, stejný účet jako web.
- **Přehled** měsíce (příjmy, výdaje, bilance, zůstatek, dluhy, výdaje podle kategorií, poslední transakce, peněženky) – čísla stejná jako na webu.
- **Transakce**: seznam po dnech, hledání, filtry, přidání, úprava, smazání se „Zpět“. Rozepsaná transakce se neztratí. Funguje i bez internetu.
- **Z banky**: čte oznámení bankovních aplikací na Androidu a platby zapíše rovnou do Transakcí (bez odhadu kategorie).
- Rozhraní v 6 jazycích: čeština, angličtina, slovenština, polština, němčina, ukrajinština. Další jazyk = jeden soubor.

## Struktura

```
packages/
  core/     čisté výpočty bez UI – parsery bank, transakce ve tvaru webu, duplicity, párování účtenek
  i18n/     překlady (locales/*.json) a formátování přes Intl
apps/
  mobile/   appka (React + Vite + Capacitor), android/ = nativní projekt
    android/app/src/main/java/cz/financeflow/nativni/   čtení oznámení (Java)
tools/      kontrola překladů a textu natvrdo
doc/        rozhodnutí, banky, jazyky
```

## Příkazy

```bash
npm install
npm run vse        # kontrola překladů + text natvrdo + typy + testy + build (totéž dělá CI)
npm run dev        # appka v prohlížeči na http://localhost:5173
```

APK pro Android sestaví GitHub Actions při každém push: záložka **Actions → poslední běh → Artifacts → financeflow-nativni-debug-apk**.

## Dokumentace

- [doc/ROZHODNUTI.md](doc/ROZHODNUTI.md) – co a proč je rozhodnuté
- [doc/BANKY.md](doc/BANKY.md) – jak přidat banku a ověřit ji na skutečných oznámeních
- [doc/JAZYKY.md](doc/JAZYKY.md) – jak přidat jazyk
- [doc/UCTENKY.md](doc/UCTENKY.md) – doskenování účtenky k platbě z oznámení (návrh)
- [doc/PRIHLASENI.md](doc/PRIHLASENI.md) – nastavení přihlášení přes Google pro Android
- [CLAUDE.md](CLAUDE.md) – pravidla pro práci s Claude
