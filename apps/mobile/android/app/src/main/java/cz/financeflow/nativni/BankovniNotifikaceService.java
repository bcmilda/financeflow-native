package cz.financeflow.nativni;

import android.app.Notification;
import android.content.ComponentName;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Log;

/**
 * Systémová služba, kterou Android volá při každém novém oznámení – jen když
 * uživatel appce povolil „Přístup k oznámením“.
 *
 * Oznámení aplikací, které uživatel nevybral, se okamžitě zahodí (neukládá se nic).
 * Oznámení vybraných bankovních aplikací se uloží do fronty a appka je zpracuje
 * (rozpozná platbu a zapíše transakci) při nejbližším spuštění nebo hned, když běží.
 */
public class BankovniNotifikaceService extends NotificationListenerService {
    private static final String TAG = "FF-Notifikace";

    /** Posluchač z pluginu – appka běží a chce o nové položce vědět hned. */
    interface Posluchac {
        void novaPolozka();
    }

    private static volatile Posluchac posluchac;

    static void nastavPosluchace(Posluchac p) {
        posluchac = p;
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        try {
            if (sbn == null) return;
            Notification n = sbn.getNotification();
            if (n == null) return;
            // Souhrn skupiny („3 nová oznámení“) není platba; jednotlivá oznámení přijdou zvlášť.
            if ((n.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return;

            String balicek = sbn.getPackageName();
            Fronta fronta = new Fronta(this);
            if (!fronta.jeVybrany(balicek)) {
                fronta.zaznamenejPruzkum(balicek, nazevAplikace(balicek));
                return;
            }

            Bundle ex = n.extras;
            if (ex == null) return;
            String titulek = text(ex.getCharSequence(Notification.EXTRA_TITLE));
            // Rozbalený text má přednost – zkrácený končí „…“ (např. číslo účtu uprostřed).
            String obsah = text(ex.getCharSequence(Notification.EXTRA_BIG_TEXT));
            if (obsah.isEmpty()) obsah = text(ex.getCharSequence(Notification.EXTRA_TEXT));

            boolean pridano = false;
            if (!obsah.isEmpty()) {
                pridano = fronta.pridej(balicek, titulek, obsah, sbn.getPostTime(), sbn.getKey());
            } else {
                // Styl „schránka“: víc řádků v jednom oznámení, každý řádek = jedna zpráva.
                CharSequence[] radky = ex.getCharSequenceArray(Notification.EXTRA_TEXT_LINES);
                if (radky != null) {
                    for (int i = 0; i < radky.length; i++) {
                        String r = text(radky[i]);
                        if (!r.isEmpty()) pridano |= fronta.pridej(balicek, titulek, r, sbn.getPostTime(), sbn.getKey() + "#" + i);
                    }
                }
            }

            Posluchac p = posluchac;
            if (pridano && p != null) p.novaPolozka();
        } catch (Exception e) {
            // Chyba v jednom oznámení nesmí shodit službu (systém by ji odpojil).
            Log.w(TAG, "Oznámení se nepodařilo zpracovat", e);
        }
    }

    @Override
    public void onListenerDisconnected() {
        // Systém službu někdy odpojí (úspora baterie, aktualizace). Požádat o znovupřipojení.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            requestRebind(new ComponentName(this, BankovniNotifikaceService.class));
        }
    }

    private String nazevAplikace(String balicek) {
        try {
            PackageManager pm = getPackageManager();
            ApplicationInfo ai = pm.getApplicationInfo(balicek, 0);
            CharSequence nazev = pm.getApplicationLabel(ai);
            return nazev != null ? nazev.toString() : balicek;
        } catch (Exception e) {
            return balicek;
        }
    }

    private static String text(CharSequence cs) {
        return cs == null ? "" : cs.toString().trim();
    }
}
