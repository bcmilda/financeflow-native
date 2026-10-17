# Session N1 · 17. 10. 2026 · n0.1 → n0.2

První session nového projektu. Commity `06ebb03` (n0.1) a `2309fcd` (n0.2) + aktualizace dokumentace.

## Rozhodnutí Milana
N-001 až N-010 v `doc/ROZHODNUTI.md`. Hlavně: samostatný projekt a klon webu, web jako mapa; 6 jazyků; oznámení rovnou do Transakcí; žádný odhad kategorie; všechny české banky (Milan KB); všechna zařízení; přihlášení Google i e-mail.

## Co vzniklo

**n0.1 – základ**
- Monorepo (npm workspaces), TypeScript strict, Vitest, CI s debug APK.
- `@ff/core`: parsery oznámení českých bank, transakce ve tvaru webu (id z notifikace = opakovaný zápis nic nezdvojí), duplicity (dvě stejné kávy nejsou duplicita), párování účtenky s platbou.
- `@ff/i18n`: 6 jazyků, ICU množná čísla, kontrola překladů a textu natvrdo.
- Android: služba čtení oznámení, fronta v telefonu, průzkum balíčků aplikací, plugin pro React.
- Obrazovky Z banky, Nastavení čtení oznámení (upozornění před souhlasem, kroky, výběr bank, peněženka podle banky i karty), Nastavení (jazyk).

**n0.2 – klon webu, první obrazovky**
- Zrušen odhad kategorie z oznámení (N-008).
- Výpočty z webu v `@ff/core` + kontraktní test proti skutečnému kódu webu.
- Datová vrstva: živá synchronizace po transakcích, snímek v zařízení, fronta zápisů, koncepty formulářů.
- Obrazovky Přehled, Transakce, formulář transakce (přidat, upravit, smazat se Zpět).
- Přihlášení Google (prohlížeč + Android), obnova hesla, pevný debug klíč.

## Ověřeno
- 99 testů (core 68 vč. 12 kontraktních, i18n 7, mobile 24), všechny procházejí. U kritických částí negativní kontrola (záměrně rozbitý kód → test selže): parsery, kontrakt s webem, fronta zápisů, kontrola překladů, kontrola textu.
- Proklikáno v Chromiu na šířce telefonu (390 a 360 px), cs / uk / de: Přehled, Transakce, hledání, filtr, úprava, nová transakce s chybou, koncept po odchodu, smazání a Zpět, přihlášení. Bez chyb v konzoli, bez vodorovného posouvání.
- Parsery KB na skutečných oznámeních Milana (anonymizováno).

## Neověřeno
- **Android build** – nikdy neproběhl (není tu Android SDK). Java kód prošel jen překladem proti náhradám API.
- Čtení oznámení na skutečném telefonu.
- Přihlášení přes Google v telefonu (čeká na Firebase Console, `doc/PRIHLASENI.md`).
- Přihlášení e-mailem proti skutečnému Firebase (z pracovního prostředí není síť na Firebase).
- Zápis do skutečné databáze a jeho zobrazení na webu.
- Parsery ostatních bank (bez vzorků), balíčky Air Bank, RB, UniCredit, mBank.

## Opravené chyby během session
- Částky se zobrazovaly „145,4 Kč“ → vždy dvě desetinná místa u neceločíselných.
- Částka v ukrajinštině přetékala kartu na úzkém displeji.
- Zápis během načítání po přihlášení mohl selhat (fronta zápisů vznikala až po snímku) → fronta vzniká hned; formulář při chybě ukáže hlášku a koncept nechá.
- Odhad kategorie z webu by „McDonald“ zařadil do Dopravy (podřetězec „cd“) – odhad nakonec zrušen celý.

## Repo
Ještě není na GitHubu. Celé repo (včetně historie) je v `financeflow-native-n0.2.zip`.
