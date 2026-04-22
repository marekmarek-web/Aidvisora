package cz.aidvisora.app;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

/**
 * Aidvisora Android host activity.
 *
 * Overrides:
 *  - {@link #onNewIntent(Intent)} — with launchMode="singleTask" the system
 *    reuses this Activity for deep-links instead of creating a new instance.
 *    Calling {@code setIntent(intent)} is required so Capacitor's Bridge +
 *    the App plugin can pick up the incoming URL via getIntent() on their
 *    own schedule. Without this, a cold-started app handles deep-links but
 *    a backgrounded-and-resumed app misses every subsequent aidvisora://
 *    payload (auth callback, navigation, push-deep-link …).
 *
 * Back button handling lives entirely on the web side — Capacitor exposes
 * hardware-back via App.addListener("backButton", …) which we consume in
 * `apps/web/src/app/shared/mobile-ui/native-runtime.tsx` and dispatch to
 * the centralized LIFO back stack. We do NOT override onBackPressed here
 * so Capacitor's default bridge behaviour (WebView history fallback) stays
 * intact as the ultimate safety net.
 */
public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
    }
}
