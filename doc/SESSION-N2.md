# Session N2 · 24. 10. 2026 · n0.2 → n0.3

Repo ještě není na GitHubu, takže blok A plánu (appka na telefonu) počká. Místo něj bloky B a C: klon dalších obrazovek webu.

## Co vzniklo
- **Navigace „Více“** (N-112): Peněženky, Kategorie, Půjčky, Nastavení. Tlačítko ‹ v hlavičce, systémové Zpět o úroveň výš.
- **Peněženky:** seznam se zůstatky a počtem transakcí, archivované zvlášť, detail peněženky se všemi jejími transakcemi (po dnech, napříč měsíci, stránkování po 100).
- **Přesun mezi peněženkami** (N-110): formulář s konceptem, kontrola (stejná peněženka, částka, datum), u různých měn povinná připsaná částka. Zápis dvou transakcí jako web. Transakce z přesunu se otevírá jako celý přesun, smazání smaže obě strany se „Zpět“.
- **Kategorie:** částky za zvolený měsíc ve třech skupinách (výdaje, příjmy, spoření a investice), klepnutí otevře Transakce filtrované na kategorii.
- **Půjčky:** souhrn (zbývá celkem, splátky za měsíc), karty půjček (typ, věřitel, úrok, splaceno %, zbývá, splátka podle frekvence, příští splátka, zbývá splátek, po splatnosti, zaplaceno v appce), splacené zvlášť.
- **Core:** `data/presuny.ts`, `data/dluhy.ts`, `pocetTransakciPenezenky`. Kontraktní test rozšířen o splátky půjček (web v12.01), zaplaceno na půjčku (v12.02) a přesun vytvořený nativní appkou spočítaný webem.

## Ověřeno
- 119 testů (core 88 vč. 20 kontraktních, i18n 7, mobile 24). Negativní kontrola: odstranění pravidla „splacená půjčka nemá splátku“, filtru `debtCeka` a koeficientu týdenní splátky → kontraktní test selže.
- Kontraktní test proti webu **v12.04** (web se od N1 posunul z v11.77; převzaté výpočty se nezměnily, nově převzatý výpočet splátek z v12.01).
- Proklikáno v Chromiu na 390 a 360 px (cs, uk, pl): Více, Peněženky, detail, detail přesunu, nový přesun (chyby, různé měny, uložení, zůstatky), smazání přesunu a Zpět, Kategorie → filtr v Transakcích, Půjčky. Bez chyb v konzoli, bez vodorovného posouvání.

## Opraveno během session
- Splacená půjčka ukazovala „0 Kč“ červeně.
- Peněženka bez zadaného typu se označovala „Jiné“ (web typ neukazuje).

## Zjištěno na webu (k rozhodnutí Milana)
- **Přesun mezi peněženkami s různou měnou** zapíše na webu do obou stejné číslo (100 € → +100 Kč). Nativní appka to dělá správně (N-110). Opravit i na webu?

## Neověřeno (beze změny od N1)
Android build, telefon, Google přihlášení v telefonu, zápis do skutečné databáze – vše čeká na repo (`doc/PLAN-SESSION-N3.md`, blok A).

## Pokračování 26. 10. 2026 · n0.3.1

- Web pushnutý do `dev` až po **v12.12** (produkce v12.10). Kontraktní test proti v12.12 prochází – od v12.04 se převzaté výpočty nezměnily (přibyly jen jednotky položek účtenek).
- `main` webu je opuštěná (poslední změna 27. 3. 2026, bez kódu appky). ⚠️ Push do `main` spustí nasazení na financeflow.cz (`firebase-hosting-merge.yml`).
- **Z provozu webu (Inbox, v12.06):** KB+ jednu platbu oznámí dvakrát (krátce a plně). Nativní appka by ji zapsala dvakrát → opraveno (N-113), 7 nových testů vč. negativní kontroly. Nové tvary textů KB+ v testech parseru.
- Při psaní testů nalezena a opravena chyba: plné oznámení doplnilo kartu, ale nechalo peněženku banky místo peněženky karty.
- Repo `bcmilda/financeflow-native` založené, ale **push odmítnut** – Claude GitHub App nemá k repu přístup pro zápis.
