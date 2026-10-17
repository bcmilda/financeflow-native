# Plán Session N2

Cíl: **dostat n0.2 na skutečný telefon a ověřit ho na tvých datech**, pak pokračovat v klonu webu (Peněženky a přesuny, Kategorie, Dluhy).

Proč v tomhle pořadí: všechno postavené v N1 je ověřené jen v prohlížeči a testech. Android build, zápis do skutečné databáze a čtení oznámení z KB+ zatím nikdo neviděl běžet. Stavět další obrazovky na neověřeném základu je riziko.

---

## Před session (Milan)

| # | Úkol | Proč | Kde |
|---|---|---|---|
| 1 | Založit na GitHubu repo `financeflow-native` (prázdné, bez README) | Kód je zatím jen v zipu; CI postaví APK | github.com → New repository |
| 2 | Firebase Console: přidat Android appku `cz.financeflow.nativni` s otiskem SHA-1 | Přihlášení přes Google v telefonu | `doc/PRIHLASENI.md` krok 1 |
| 3 | Poslat **Web client ID** | Totéž | `doc/PRIHLASENI.md` krok 2 |
| 4 | Rozhodnout 2 odchylky od webu (níže) | Ať obě appky počítají stejně | – |
| 5 | Screenshot dalších oznámení KB+: **příchozí platba**, výběr z bankomatu, platba v cizí měně; rozbalenou **odchozí platbu** (celý text) | Rozšíření a ověření parseru KB | rozbalit oznámení, screenshot |
| 6 | (volitelně) Oznámení jiných bank od lidí kolem tebe | Parsery ostatních bank | – |

### Rozhodnutí k odchylkám (N-108)
1. **„Ostatní“ v dlaždicích:** web do nich počítá i přesuny a rozdělené platby (součet dlaždic > Výdaje). Nativní appka ne. → Opravit i na webu? / Nechat web, jak je?
2. **Staré transakce jen s `amt`:** web je nepočítá do zůstatku peněženky. → Opravit v obou appkách? / Nechat?

---

## Začátek session (Claude)

1. Obnovit repo: z GitHubu, pokud existuje; jinak rozbalit `financeflow-native-n0.2.zip` a nahrát na GitHub (`add_repo` s přístupem push).
2. `npm ci && npm run vse` – musí projít (99 testů). Web naklonovat vedle (`bcmilda/financeflow`, `dev`) kvůli kontraktnímu testu.
3. Přečíst `CLAUDE.md`, `doc/ROZHODNUTI.md`, `doc/ARCHITEKTURA.md`, tento plán.
4. Zkontrolovat, jestli se web od v11.77 nezměnil ve výpočtech (`git log` webu, helpers.js / premium.js) – kontraktní test to ukáže.

---

## Blok A · Appka na telefonu (priorita 1)

**A1 · První Android build v CI.** Spustit workflow, opravit případné chyby Javy/Gradle (kód nikdy neprošel skutečným buildem). Stáhnout APK z Actions → Artifacts.
*Hotovo, když:* CI je zelené a APK jde nainstalovat.

**A2 · Google přihlášení.** Vložit Web client ID do `konfigurace.ts`, nový build.
*Hotovo, když:* přihlášení Googlem i e-mailem v telefonu funguje a ukáže tvoje data.

**A3 · Testovací průchod na telefonu (Milan + Claude podle screenshotů):**
- [ ] Přehled za říjen ukazuje stejná čísla jako Dashboard webu (příjmy, výdaje, bilance, zůstatek).
- [ ] Transakce přidaná v telefonu se objeví na webu; přidaná na webu se objeví v telefonu.
- [ ] Úprava kategorie v telefonu nezničí položky účtenky (ověřit na transakci z účtenky).
- [ ] Smazání + Zpět vrátí transakci i na webu.
- [ ] Režim letadlo: přidat transakci, zavřít appku, zapnout internet, otevřít → transakce je na webu.
- [ ] Rozepsaná transakce přežije zavření appky.
- [ ] Z banky: povolit přístup k oznámením, úsporu baterie, vybrat KB → skutečná platba kartou se zapíše do Transakcí (bez kategorie), na webu je vidět.
- [ ] Budoucí splátka 4U karty se nezapíše.
- [ ] Systémové tlačítko Zpět se chová rozumně.

**A4 · Opravy z průchodu.** Každá chyba dostane test, který na starém kódu selže.

## Blok B · Peněženky a přesuny (klon webu)

Web: `js/premium.js` – `renderPenezenky`, `doTransfer` (pár transakcí se stejným `transferId`, `category: 'transfer'`, id ve tvaru `uid()`), zůstatek ke dni (`balanceDate`, `balanceSetAt`), archiv, převod v cizí měně.

- B1 · Obrazovka **Peněženky**: seznam se zůstatky, archivované zvlášť, počet transakcí. Výpočty už jsou v core (`zustatekPenezenky`).
- B2 · **Přesun mezi peněženkami**: formulář (z, do, částka, datum, poznámka), zápis dvou transakcí jako web. Převod do cíle (virtuální peněženka) až později.
- B3 · Úprava peněženky (název, počáteční zůstatek / zůstatek ke dni). ⚠️ Peněženky web ukládá jako **celé pole** `data/wallets` – zápis z telefonu by mohl přepsat souběžnou změnu z webu. Navrhnout bezpečný postup (např. update jen konkrétního indexu po ověření id), před zápisem probrat s Milanem.
- *Hotovo, když:* přesun z telefonu se na webu zobrazí jako přesun a zůstatky obou peněženek sedí v obou appkách (kontraktní test rozšířit o přesun).

## Blok C · Kategorie a Dluhy (čtení)

- C1 · **Kategorie**: seznam s výdaji za měsíc, rozklik na transakce kategorie (podkategorie). Správa kategorií až po vyřešení zápisu polí (stejný problém jako peněženky).
- C2 · **Půjčky**: seznam dluhů, zbývá, splátka (čtení). Výpočty přenést z `js/debts.js` + kontraktní test.

## Blok D · K rozhodnutí (návrh, nestavět bez souhlasu)

- **Zápis oznámení na pozadí**, když appka neběží (dnes se zapíše až po otevření). Možnosti: Capacitor Background Runner (JS na pozadí, interval ≥ 15 min) nebo nativní WorkManager se zápisem přes REST. Obojí potřebuje přihlašovací token v telefonu.
- **iPhone**: Zkratky + Apple Pay → appka (ověřit, jestli to české karty podporují).
- **Doskenování účtenky** k platbě z oznámení (`doc/UCTENKY.md`) – potřebuje skener a import účtenek z webu.

---

## Konec session

- `npm run vse` zelené, CI zelené, APK v Actions.
- Dokumentace: připsat sekci na konec `doc/SESSION-N2.md`, aktualizovat `doc/PARITA.md`, `doc/ARCHITEKTURA.md`, nová rozhodnutí do `doc/ROZHODNUTI.md` (nepřepisovat staré záznamy).
- Plán další session `doc/PLAN-SESSION-N3.md`.
