/**
 * Veřejná konfigurace appky (nic tajného – stejné údaje jsou ve webové appce).
 */

/**
 * Webové OAuth ID z Firebase Console → Authentication → Sign-in method → Google →
 * „Web SDK configuration“ → Web client ID (končí na .apps.googleusercontent.com).
 * Na Androidu je potřeba pro přihlášení přes Google. Dokud je prázdné, Google
 * přihlášení funguje jen v prohlížeči a v telefonu appka řekne, že není nastavené.
 */
export const GOOGLE_WEB_CLIENT_ID = '';
