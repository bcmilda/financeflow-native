package cz.financeflow.nativni;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Vlastní plugin musí být registrovaný před super.onCreate.
        registerPlugin(BankovniNotifikacePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
