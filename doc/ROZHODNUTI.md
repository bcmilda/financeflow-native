# Rozhodnutí

Číslování `N-xxx`, aby se nepletlo s ADR webu. Nový záznam = nové číslo na konec, starý se nepřepisuje.

## 17. 10. 2026 · založení projektu (Milan)

**N-001 · Samostatný projekt.** Nový repozitář vedle webu. Má doplnit slabiny webu (rozepsaná práce, okamžité změny, stabilita), vylepšit čtení i zápis a jednou možná web nahradit. Web se dál vyvíjí.

**N-002 · Dokumentace webu je mapa, ne pravidla.** `doc/*.md` v repu `bcmilda/financeflow` slouží k orientaci v obrazovkách a k pochopení, jak výpočty správně fungují. Pravidla tohoto projektu jsou tady.

**N-003 · Jazyky od prvního řádku:** cs, en, sk, pl, de, uk a další. Žádný text v kódu, vše přes klíče překladu. Build selže při textu natvrdo nebo chybějícím překladu.

**N-004 · Jazyk ≠ země.** Jazyk rozhraní a země (daně, banky, svátky) jsou dvě nastavení.

**N-005 · Oznámení z banky se zapisují rovnou do Transakcí.** Žádný mezikrok „Doručené k potvrzení“. Ochrany proti chybám:
- zapisují se jen provedené platby (budoucí splátka, ověření platby, kódy se zahodí),
- tatáž notifikace nikdy nevytvoří druhou transakci (id odvozené z notifikace),
- platba už zapsaná jinak (ručně, výpisem) se nezapíše a appka nabídne „Přesto přidat“,
- platba v cizí měně se nezapíše (bez kurzu by částka nebyla správně).

**N-006 · Všechny české banky.** Milan má KB (KB+). Pravidla KB jsou ověřená na skutečných oznámeních, ostatní banky čekají na vzorky (`doc/BANKY.md`).

**N-007 · Musí fungovat na všech zařízeních.**
- Android: všechny značky. U Xiaomi, Samsungu a Huawei appka provede vypnutím úspory baterie.
- iPhone: Apple žádné appce nedovolí číst oznámení jiných aplikací. Náhrada: automatizace ve Zkratkách při platbě Apple Pay (zatím nepostavené).

## Technická rozhodnutí (Claude, k připomínkám)

**N-101 · Sada:** TypeScript (strict) + React + Vite + Capacitor 8. Nativní část v Javě (čtení oznámení). Testy Vitest.

**N-102 · Zápis po jedné transakci.** Appka zapisuje jen `users/{uid}/data/transactions/{id}`, nikdy celé `data`. Web ostatní sekce ukládá jako celky a přepsal by si je s telefonem navzájem. Nové transakce web přijímá přes `onChildAdded` a ukáže je hned.

**N-103 · Tvar transakce = tvar webu** (`amount` i `amt`, `catId` i `category`, `date` `YYYY-MM-DD`, číselné `id` jako `Date.now()*16 + 0..15`). Navíc pole `zdroj: 'notifikace'`, `notifKlic`, `notifBanka`, `karta4`.

**N-104 · Do Firebase nejde text oznámení ani čísla účtů a karet** (jen poslední 4 číslice karty kvůli přiřazení peněženky). Nerozpoznaná oznámení zůstávají jen v telefonu 30 dní.

**N-105 · Balíček appky `cz.financeflow.nativni`** – jiný než dnešní webová appka v Play (`cz.financeflow.app`), aby mohly běžet vedle sebe.

**N-106 · Přihlášení zatím e-mailem a heslem.** Google přihlášení v appce potřebuje v Firebase Console přidat Android appku a otisk podpisu (další krok).

## Otevřené

- Zápis na pozadí, když appka neběží. Dnes se oznámení uloží do fronty v telefonu vždy, transakce se zapíše při nejbližším otevření appky (nebo hned, když běží).
- iPhone: Zkratky + Apple Pay.
- Ověřit balíčky aplikací Air Bank, Raiffeisenbank, UniCredit a mBank (průzkum v appce).
- Doskenování účtenky k platbě z oznámení (`doc/UCTENKY.md`).
