# Přihlášení přes Google v Android appce

V prohlížeči funguje hned (okno Google, jako na webu). V telefonu jsou potřeba dva kroky v konzoli Google – jednorázově.

## 1. Otisk podpisu appky (SHA-1)

Ladicí verze appky (APK z GitHub Actions) je podepsaná pevným klíčem `apps/mobile/android/app/debug.keystore`:

```
balíček: cz.financeflow.nativni
SHA-1:   4B:6E:6E:23:0D:5B:3A:1D:75:34:4C:96:FB:DC:E3:CD:E6:17:B8:33
```

**Firebase Console** → projekt `financeflow-a249c` → ⚙️ Nastavení projektu → Vaše aplikace → **Přidat aplikaci → Android**:
- název balíčku `cz.financeflow.nativni`,
- otisk SHA-1 výše.

Firebase tím v Google Cloud sám založí Android OAuth klienta. Soubor `google-services.json`, který nabídne ke stažení, appka nepotřebuje.

Pro verzi v Google Play se později přidá ještě otisk klíče z Play Console (App integrity → App signing key).

## 2. Web client ID

**Firebase Console** → Authentication → Sign-in method → **Google** → rozbalit „Web SDK configuration“ → **Web client ID** (končí na `.apps.googleusercontent.com`).

Hodnotu vložit do `apps/mobile/src/konfigurace.ts` (`GOOGLE_WEB_CLIENT_ID`). Není tajná.

Do té doby appka v telefonu napíše, že přihlášení přes Google není nastavené, a nabídne e-mail.
