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

## 17. 10. 2026 · upřesnění (Milan)

**N-008 · Žádný odhad kategorie z oznámení.** Transakce z oznámení se zapíše bez kategorie. Kategorii dá uživatel, nebo položky připojené účtenky. Ruší dřívější odhad podle obchodníka (z webu).

**N-009 · Nativní appka je klon webu, jen vyladěnější.** Stejné obrazovky a stejné výpočty, lepší chování (okamžité změny, nic se neztratí, jazyky). Výpočty se přenášejí z webu a kontraktní test hlídá, že dávají stejná čísla.

**N-010 · Přihlášení oběma způsoby:** Google i e-mail a heslo (stejně jako web).

## Technická rozhodnutí (Claude, k připomínkám)

**N-101 · Sada:** TypeScript (strict) + React + Vite + Capacitor 8. Nativní část v Javě (čtení oznámení). Testy Vitest.

**N-102 · Zápis po jedné transakci.** Appka zapisuje jen `users/{uid}/data/transactions/{id}`, nikdy celé `data`. Web ostatní sekce ukládá jako celky a přepsal by si je s telefonem navzájem. Nové transakce web přijímá přes `onChildAdded` a ukáže je hned.

**N-103 · Tvar transakce = tvar webu** (`amount` i `amt`, `catId` i `category`, `date` `YYYY-MM-DD`, číselné `id` jako `Date.now()*16 + 0..15`). Navíc pole `zdroj: 'notifikace'`, `notifKlic`, `notifBanka`, `karta4`.

**N-104 · Do Firebase nejde text oznámení ani čísla účtů a karet** (jen poslední 4 číslice karty kvůli přiřazení peněženky). Nerozpoznaná oznámení zůstávají jen v telefonu 30 dní.

**N-105 · Balíček appky `cz.financeflow.nativni`** – jiný než dnešní webová appka v Play (`cz.financeflow.app`), aby mohly běžet vedle sebe.

**N-106 · Přihlášení přes Google na Androidu** jde přes systémový výběr účtu (Credential Manager, plugin `@capgo/capacitor-social-login`), z něj ID token → Firebase. Nepotřebuje `google-services.json`. Potřebuje Web client ID a otisk SHA-1 v Google Cloud – postup v `doc/PRIHLASENI.md`. Debug build se podepisuje pevným klíčem z repa, aby otisk zůstal stejný.

**N-107 · Kontraktní test s webem.** `packages/core/test/kontrakt-web.test.ts` pouští stejná data přes funkce webu (incSum, expSum, getActual, computeBank, computeWalletBalance) i přes `@ff/core`. Rozdíl = chyba.

**N-108 · Vědomé odchylky od webu (vyladění):**
- „Bez kategorie“ ve výdajích podle kategorií nepočítá přesuny a rozdělené rodiče (web je v „Ostatní“ počítá, takže součet dlaždic může být vyšší než Výdaje).
- Zůstatek peněženky počítá stejně jako web, včetně toho, že starší transakce jen s polem `amt` (bez `amount`) do zůstatku peněženky nevstupují. Rozhodne Milan, jestli opravit v obou appkách.

**N-109 · Data v telefonu.** Živá synchronizace po jednotlivých transakcích, poslední snímek dat v zařízení (start bez internetu), fronta zápisů v zařízení (zápis bez internetu se odešle později, i po restartu), koncepty rozepsaných formulářů. Úprava transakce zapisuje jen změněná pole. Mazání bez dotazu, se „Zpět“.

**N-110 · Přesun mezi peněženkami jako web** (`premium.js doTransfer`): dvě transakce se společným `transferId`, `category: 'transfer'`, id ve tvaru `uid()` (`'id' + ms + 4 znaky`). Název transakce v jazyce uživatele (data se nepřekládají zpětně).
- Vyladění proti webu: web při různé měně peněženek zapíše do obou stejné číslo (100 € → +100 Kč). Nativní appka chce i připsanou částku v cílové měně.
- Transakce z přesunu se v nativní appce otevírá jako celý přesun. Jednu stranu samostatně upravit nejde (rozbil by se pár), smazání smaže obě strany se „Zpět“.

**N-111 · Peněženky, kategorie a půjčky zatím jen ke čtení.** Web je ukládá jako celá pole (`data/wallets`, `data/categories`, `data/debts`) – zápis z telefonu by mohl přepsat souběžnou změnu z webu. Úpravy až s bezpečným slučováním (k návrhu v další session).

**N-112 · Navigace:** spodní menu Přehled · Transakce · Z banky · Více. „Více“ je rozcestník dalších obrazovek klonu (Peněženky, Kategorie, Půjčky, Nastavení). Tlačítko ‹ v hlavičce a systémové Zpět vedou o úroveň výš.

## Otevřené

- Zápis na pozadí, když appka neběží. Dnes se oznámení uloží do fronty v telefonu vždy, transakce se zapíše při nejbližším otevření appky (nebo hned, když běží).
- iPhone: Zkratky + Apple Pay.
- Ověřit balíčky aplikací Air Bank, Raiffeisenbank, UniCredit a mBank (průzkum v appce).
- Doskenování účtenky k platbě z oznámení (`doc/UCTENKY.md`). Kategorie po připojení: z položek účtenky (N-008).
- Další obrazovky webu: přesuny mezi peněženkami, rozpočty, dluhy, účtenky, výplatnice, měřidla, vozidla…
