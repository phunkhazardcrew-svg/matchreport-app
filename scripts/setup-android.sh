#!/bin/bash
set -e
echo "=== Injecting Ringtone Plugin (Java) ==="

PLUGIN_DIR="android/app/src/main/java/com/matchreport/app/ringtones"
mkdir -p "$PLUGIN_DIR"

# Remove any old Kotlin file
rm -f "$PLUGIN_DIR/RingtonePlugin.kt"

# Write plugin in JAVA (not Kotlin - Capacitor projects are Java by default)
cat > "$PLUGIN_DIR/RingtonePlugin.java" << 'JEOF'
package com.matchreport.app.ringtones;

import android.content.ContentUris;
import android.media.AudioManager;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.media.ToneGenerator;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import android.database.Cursor;

@CapacitorPlugin(name = "Ringtones")
public class RingtonePlugin extends Plugin {

    private Ringtone currentRingtone = null;

    @PluginMethod
    public void list(PluginCall call) {
        JSArray arr = new JSArray();
        try {
            RingtoneManager mgr = new RingtoneManager(getContext());
            mgr.setType(RingtoneManager.TYPE_ALL);
            Cursor cursor = mgr.getCursor();
            while (cursor.moveToNext()) {
                String title = cursor.getString(RingtoneManager.TITLE_COLUMN_INDEX);
                String baseUri = cursor.getString(RingtoneManager.URI_COLUMN_INDEX);
                long id = cursor.getLong(RingtoneManager.ID_COLUMN_INDEX);
                JSObject obj = new JSObject();
                obj.put("title", title);
                obj.put("uri", ContentUris.withAppendedId(Uri.parse(baseUri), id).toString());
                arr.put(obj);
            }
        } catch (Exception e) { /* empty list on error */ }
        JSObject ret = new JSObject();
        ret.put("ringtones", arr);
        call.resolve(ret);
    }

    @PluginMethod
    public void play(PluginCall call) {
        String uriStr = call.getString("uri");
        if (uriStr == null) { call.reject("Missing uri"); return; }
        try {
            if (currentRingtone != null) { currentRingtone.stop(); }
            currentRingtone = RingtoneManager.getRingtone(getContext(), Uri.parse(uriStr));
            if (currentRingtone != null) currentRingtone.play();
        } catch (Exception e) { /* ignore */ }
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        try { if (currentRingtone != null) currentRingtone.stop(); } catch (Exception e) { }
        currentRingtone = null;
        call.resolve();
    }

    @PluginMethod
    public void playLoud(PluginCall call) {
        try {
            // ToneGenerator on STREAM_ALARM — always plays even on silent/vibrate
            ToneGenerator tg = new ToneGenerator(AudioManager.STREAM_ALARM, 100);
            tg.startTone(ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD, 1500);
            new Handler(Looper.getMainLooper()).postDelayed(tg::release, 2000);
        } catch (Exception e) { /* ignore */ }
        call.resolve();
    }

    @PluginMethod
    public void pick(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("uri", (String) null);
        ret.put("cancelled", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void getDefault(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            Uri uri = RingtoneManager.getActualDefaultRingtoneUri(getContext(), RingtoneManager.TYPE_NOTIFICATION);
            ret.put("uri", uri != null ? uri.toString() : null);
        } catch (Exception e) {
            ret.put("uri", (String) null);
        }
        call.resolve(ret);
    }
}
JEOF

echo "Java plugin written: $PLUGIN_DIR/RingtonePlugin.java"

# Modify MainActivity
python3 << 'PYEOF'
import os
path = "android/app/src/main/java/com/matchreport/app/MainActivity.java"
if not os.path.exists(path):
    print(f"WARNING: {path} not found"); exit(0)
content = open(path).read()
if "RingtonePlugin" in content:
    print("Already registered"); exit(0)
content = content.replace(
    "import com.getcapacitor.BridgeActivity;",
    "import com.getcapacitor.BridgeActivity;\nimport com.matchreport.app.ringtones.RingtonePlugin;"
)
content = content.replace(
    "public class MainActivity extends BridgeActivity {}",
    "public class MainActivity extends BridgeActivity {\n    @Override\n    public void onCreate(android.os.Bundle savedInstanceState) {\n        registerPlugin(RingtonePlugin.class);\n        super.onCreate(savedInstanceState);\n    }\n}"
)
open(path, 'w').write(content)
print("MainActivity updated")
PYEOF

echo "=== Done ==="
