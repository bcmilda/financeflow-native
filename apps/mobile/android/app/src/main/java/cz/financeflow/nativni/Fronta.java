package cz.financeflow.nativni;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.Collection;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

/**
 * Fronta zachycených notifikací v telefonu (SharedPreferences).
 *
 * Položka se smaže, až když ji appka potvrdí (= zapsala do Firebase nebo vyhodnotila).
 * Bez internetu nebo při pádu appky tak nic nezmizí.
 *
 * Do fronty jdou jen notifikace aplikací, které uživatel vybral. Ostatní se neukládají.
 * Výjimka: během průzkumu (max. pár minut na vyžádání) se ukládá jen NÁZEV aplikace,
 * nikdy obsah – aby šlo najít balíček banky, který katalog nezná.
 */
final class Fronta {
    private static final String SOUBOR = "ff_bankovni_notifikace";
    private static final String K_FRONTA = "fronta";
    private static final String K_VYBRANE = "vybrane";
    private static final String K_VIDENE = "videne";
    private static final String K_PRUZKUM_DO = "pruzkumDo";
    private static final String K_PRUZKUM = "pruzkum";
    private static final int MAX_FRONTA = 500;
    private static final int MAX_VIDENE = 300;
    /** Služba i plugin běží ve stejném procesu – jeden zámek pro obě instance. */
    private static final Object ZAMEK = new Object();

    private final SharedPreferences sp;

    Fronta(Context c) {
        sp = c.getApplicationContext().getSharedPreferences(SOUBOR, Context.MODE_PRIVATE);
    }

    boolean jeVybrany(String balicek) {
        return sp.getStringSet(K_VYBRANE, Collections.<String>emptySet()).contains(balicek);
    }

    void nastavVybrane(Collection<String> balicky) {
        sp.edit().putStringSet(K_VYBRANE, new HashSet<>(balicky)).apply();
    }

    /** @return true, když se položka přidala (false = duplicitní doručení téže notifikace). */
    boolean pridej(String balicek, String titulek, String text, long cas, String klicNotifikace) {
        synchronized (ZAMEK) {
            try {
                String otisk = klicNotifikace + "|" + (titulek + "\n" + text).hashCode();
                JSONArray videne = new JSONArray(sp.getString(K_VIDENE, "[]"));
                for (int i = 0; i < videne.length(); i++) {
                    if (otisk.equals(videne.optString(i))) return false;
                }
                JSONArray noveVidene = new JSONArray();
                int od = Math.max(0, videne.length() - (MAX_VIDENE - 1));
                for (int i = od; i < videne.length(); i++) noveVidene.put(videne.optString(i));
                noveVidene.put(otisk);

                JSONArray fronta = new JSONArray(sp.getString(K_FRONTA, "[]"));
                JSONObject o = new JSONObject();
                o.put("id", UUID.randomUUID().toString());
                o.put("balicek", balicek);
                o.put("titulek", titulek);
                o.put("text", text);
                o.put("cas", cas);
                fronta.put(o);
                JSONArray oriznuta = new JSONArray();
                int odF = Math.max(0, fronta.length() - MAX_FRONTA);
                for (int i = odF; i < fronta.length(); i++) oriznuta.put(fronta.get(i));

                sp.edit().putString(K_FRONTA, oriznuta.toString()).putString(K_VIDENE, noveVidene.toString()).commit();
                return true;
            } catch (JSONException e) {
                return false;
            }
        }
    }

    String fronta() {
        synchronized (ZAMEK) {
            return sp.getString(K_FRONTA, "[]");
        }
    }

    void potvrd(Set<String> ids) {
        synchronized (ZAMEK) {
            try {
                JSONArray fronta = new JSONArray(sp.getString(K_FRONTA, "[]"));
                JSONArray zbytek = new JSONArray();
                for (int i = 0; i < fronta.length(); i++) {
                    JSONObject o = fronta.getJSONObject(i);
                    if (!ids.contains(o.optString("id"))) zbytek.put(o);
                }
                sp.edit().putString(K_FRONTA, zbytek.toString()).commit();
            } catch (JSONException e) {
                // Poškozená fronta – nechat být, nic nemazat.
            }
        }
    }

    // ── Průzkum: jaké aplikace posílají oznámení (jen název, bez obsahu) ──

    void spustPruzkum(int minut) {
        sp.edit()
            .putLong(K_PRUZKUM_DO, System.currentTimeMillis() + minut * 60_000L)
            .putString(K_PRUZKUM, "{}")
            .apply();
    }

    long pruzkumDo() {
        return sp.getLong(K_PRUZKUM_DO, 0L);
    }

    void zaznamenejPruzkum(String balicek, String nazev) {
        if (System.currentTimeMillis() > pruzkumDo()) return;
        synchronized (ZAMEK) {
            try {
                JSONObject p = new JSONObject(sp.getString(K_PRUZKUM, "{}"));
                p.put(balicek, nazev);
                sp.edit().putString(K_PRUZKUM, p.toString()).apply();
            } catch (JSONException e) {
                // ignorovat
            }
        }
    }

    JSONObject pruzkum() {
        try {
            return new JSONObject(sp.getString(K_PRUZKUM, "{}"));
        } catch (JSONException e) {
            return new JSONObject();
        }
    }
}
