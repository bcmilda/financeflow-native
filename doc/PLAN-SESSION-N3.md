# Plán Session N3

> Navazuje na plán N2: bloky B a C jsou hotové (n0.3, `doc/SESSION-N2.md`), blok A čeká na repo.

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

### Rozhodnutí k odchylkám (N-108, N-110)
1. **„Ostatní“ v dlaždicích:** web do nich počítá i přesuny a rozdělené platby (součet dlaždic > Výdaje). Nativní appka ne. → Opravit i na webu? / Nechat web, jak je?
2. **Staré transakce jen s `amt`:** web je nepočítá do zůstatku peněženky. → Opravit v obou appkách? / Nechat?
3. **Přesun s různou měnou na webu** zapíše do obou peněženek stejné číslo (100 € → +100 Kč). Nativní appka chce připsanou částku. → Opravit i na webu?

---

## Začátek session (Claude)

1. Obnovit repo: z GitHubu, pokud existuje; jinak rozbalit `financeflow-native-n0.3.zip` a nahrát na GitHub (`add_repo` s přístupem push).
2. `npm ci && npm run vse` – musí projít (119 testů). Web naklonovat vedle (`bcmilda/financeflow`, `dev`) kvůli kontraktnímu testu.
3. Přečíst `CLAUDE.md`, `doc/ROZHODNUTI.md`, `doc/ARCHITEKTURA.md`, tento plán.
4. Zkontrolovat, jestli se web od v12.04 nezměnil ve výpočtech (`git log` webu, helpers.js / premium.js / debts.js) – kontraktní test to ukáže.

---

## Blok A · Appka na telefonu (priorita 1)

**A1 · První Android build v CI.** Spustit workflow, opravit případné chyby Javy/Gradle (kód nikdy neprošel skutečným buildem). Stáhnout APK z Actions → Artifacts.
*Hotovo, když:* CI je zelené a APK jde nainstalovat.

**A2 · Google přihlášení.** Vložit Web client ID do `konfigurace.ts`, nový build.
*Hotovo, když:* přihlášení Googlem i e-mailem v telefonu funguje a ukáže tvoje data.

**A3 · Testovací průchod na telefonu (Milan + Claude podle screenshotů):**
- [ ] Přehled za říjen ukazuje stejná čísla jako Dashboard webu (příjmy, výdaje, bilance, zůstatek).
- [ ] Peněženky: zůstatky jako na webu; přesun z telefonu je na webu vidět jako přesun a zůstatky sedí.
- [ ] Půjčky: zbývá a splátky jako na webu.
- [ ] Transakce přidaná v telefonu se objeví na webu; přidaná na webu se objeví v telefonu.
- [ ] Úprava kategorie v telefonu nezničí položky účtenky (ověřit na transakci z účtenky).
- [ ] Smazání + Zpět vrátí transakci i na webu.
- [ ] Režim letadlo: přidat transakci, zavřít appku, zapnout internet, otevřít → transakce je na webu.
- [ ] Rozepsaná transakce přežije zavření appky.
- [ ] Z banky: povolit přístup k oznámením, úsporu baterie, vybrat KB → skutečná platba kartou se zapíše do Transakcí (bez kategorie), na webu je vidět.
- [ ] Budoucí splátka 4U karty se nezapíše.
- [ ] Systémové tlačítko Zpět se chová rozumně.

**A4 · Opravy z průchodu.** Každá chyba dostane test, který na starém kódu selže.

## Blok B · Bezpečný zápis peněženek, kategorií a půjček (návrh → Milan)

Web ukládá `data/wallets`, `data/categories`, `data/debts` jako **celá pole**. Telefon je zatím jen čte (N-111). Než přibudou úpravy:
- B1 · Navrhnout bezpečný zápis (update jedné položky pole po ověření `id` na stejném indexu přes transakci Firebase, jinak odmítnout a načíst znovu) a ověřit ho proti webu (souběžná úprava na webu a v telefonu).
- B2 · Teprve potom: založení / úprava peněženky, zůstatek ke dni (S25, `balanceDate`), správa kategorií.

## Blok C · Další obrazovky klonu (čtení)

Podle `doc/PARITA.md`, pořadí podle užitku na telefonu:
- C1 · **Budoucí platby / Opakované šablony** (co mě čeká do výplaty).
- C2 · **Kalendář splátek půjčky** a jistina/úrok (`debtPlnyPlan`, `generateSchedule` z `debts.js` + kontraktní test).
- C3 · **Grafy na Přehledu** (12 měsíců příjmy/výdaje) – podle pravidel grafů ze SKILL webu.

## Blok D · K rozhodnutí (návrh, nestavět bez souhlasu)

- **Zápis oznámení na pozadí**, když appka neběží (dnes se zapíše až po otevření). Možnosti: Capacitor Background Runner (JS na pozadí, interval ≥ 15 min) nebo nativní WorkManager se zápisem přes REST. Obojí potřebuje přihlašovací token v telefonu.
- **iPhone**: Zkratky + Apple Pay → appka (ověřit, jestli to české karty podporují).
- **Doskenování účtenky** k platbě z oznámení (`doc/UCTENKY.md`) – potřebuje skener a import účtenek z webu.

---

## Konec session

- `npm run vse` zelené, CI zelené, APK v Actions.
- Dokumentace: `doc/SESSION-N3.md`, aktualizovat `doc/PARITA.md`, `doc/ARCHITEKTURA.md`, nová rozhodnutí do `doc/ROZHODNUTI.md` (nepřepisovat staré záznamy).
- Plán další session `doc/PLAN-SESSION-N4.md`.
