package cz.financeflow.nativni;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.HashSet;
import java.util.Iterator;
import java.util.List;

/**
 * Most mezi webovou částí appky (TypeScript) a nativní službou.
 * Rozhraní v TS: apps/mobile/src/notifikace/plugin.ts
 */
@CapacitorPlugin(name = "BankovniNotifikace")
public class BankovniNotifikacePlugin extends Plugin {

    @Override
    public void load() {
        BankovniNotifikaceService.nastavPosluchace(() -> notifyListeners("notifikace", new JSObject()));
    }

    @Override
    protected void handleOnDestroy() {
        BankovniNotifikaceService.nastavPosluchace(null);
    }

    @PluginMethod
    public void stav(PluginCall call) {
        Context c = getContext();
        JSObject r = new JSObject();
        r.put("android", true);
        r.put("pristup", NotificationManagerCompat.getEnabledListenerPackages(c).contains(c.getPackageName()));
        boolean baterie = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) c.getSystemService(Context.POWER_SERVICE);
            baterie = pm != null && pm.isIgnoringBatteryOptimizations(c.getPackageName());
        }
        r.put("baterie", baterie);
        call.resolve(r);
    }

    @PluginMethod
    public void otevritPristup(PluginCall call) {
        Intent i;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            // Rovnou detail naší appky v seznamu „Přístup k oznámením“.
            i = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS);
            i.putExtra(Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME,
                new ComponentName(getContext(), BankovniNotifikaceService.class).flattenToString());
        } else {
            i = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
        }
        if (!spustit(i)) spustit(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS));
        call.resolve();
    }

    @PluginMethod
    public void otevritBaterii(PluginCall call) {
        // Seznam appek v úspoře baterie. Přímou žádost (REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
        // Google Play pro finanční appky nepovoluje.
        if (!spustit(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))) {
            spustit(new Intent(Settings.ACTION_SETTINGS));
        }
        call.resolve();
    }

    @PluginMethod
    public void nastavitBanky(PluginCall call) {
        try {
            JSArray a = call.getArray("balicky", new JSArray());
            List<String> balicky = a.toList();
            new Fronta(getContext()).nastavVybrane(balicky);
            call.resolve();
        } catch (JSONException e) {
            call.reject("Neplatný seznam bank");
        }
    }

    @PluginMethod
    public void vyzvednout(PluginCall call) {
        try {
            JSObject r = new JSObject();
            r.put("polozky", new JSArray(new Fronta(getContext()).fronta()));
            call.resolve(r);
        } catch (JSONException e) {
            call.reject("Frontu se nepodařilo přečíst");
        }
    }

    @PluginMethod
    public void potvrdit(PluginCall call) {
        try {
            List<String> ids = call.getArray("ids", new JSArray()).toList();
            new Fronta(getContext()).potvrd(new HashSet<>(ids));
            call.resolve();
        } catch (JSONException e) {
            call.reject("Neplatný seznam položek");
        }
    }

    @PluginMethod
    public void spustitPruzkum(PluginCall call) {
        Integer minut = call.getInt("minut", 5);
        new Fronta(getContext()).spustPruzkum(minut == null ? 5 : Math.max(1, Math.min(minut, 15)));
        call.resolve();
    }

    @PluginMethod
    public void vysledekPruzkumu(PluginCall call) {
        Fronta f = new Fronta(getContext());
        JSONObject p = f.pruzkum();
        JSArray aplikace = new JSArray();
        Iterator<String> klice = p.keys();
        while (klice.hasNext()) {
            String balicek = klice.next();
            JSObject o = new JSObject();
            o.put("balicek", balicek);
            o.put("nazev", p.optString(balicek, balicek));
            aplikace.put(o);
        }
        JSObject r = new JSObject();
        r.put("do", f.pruzkumDo());
        r.put("aplikace", aplikace);
        call.resolve(r);
    }

    private boolean spustit(Intent i) {
        try {
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
