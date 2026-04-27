#!/bin/bash
set -e
echo "=== Injecting Ringtone Plugin ==="

PLUGIN_DIR="android/app/src/main/java/com/matchreport/app/ringtones"
mkdir -p "$PLUGIN_DIR"

# Super minimal Kotlin plugin - only playLoud + list + play + stop
cat > "$PLUGIN_DIR/RingtonePlugin.kt" << 'KTEOF'
package com.matchreport.app.ringtones

import android.content.ContentUris
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.Ringtone
import android.media.RingtoneManager
import android.media.ToneGenerator
import android.net.Uri
import android.os.Handler
import android.os.Looper
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "Ringtones")
class RingtonePlugin : Plugin() {

    private var currentRingtone: Ringtone? = null

    @PluginMethod
    fun list(call: PluginCall) {
        val arr = JSArray()
        try {
            val mgr = RingtoneManager(context)
            mgr.setType(RingtoneManager.TYPE_ALL)
            val cursor = mgr.cursor
            while (cursor.moveToNext()) {
                val title = cursor.getString(RingtoneManager.TITLE_COLUMN_INDEX)
                val baseUri = cursor.getString(RingtoneManager.URI_COLUMN_INDEX)
                val id = cursor.getLong(RingtoneManager.ID_COLUMN_INDEX)
                val obj = JSObject()
                obj.put("title", title)
                obj.put("uri", ContentUris.withAppendedId(Uri.parse(baseUri), id).toString())
                arr.put(obj)
            }
        } catch (e: Exception) { /* empty list on error */ }
        val ret = JSObject()
        ret.put("ringtones", arr)
        call.resolve(ret)
    }

    @PluginMethod
    fun play(call: PluginCall) {
        val uriStr = call.getString("uri")
        if (uriStr == null) { call.reject("Missing uri"); return }
        try {
            currentRingtone?.stop()
            currentRingtone = RingtoneManager.getRingtone(context, Uri.parse(uriStr))
            currentRingtone?.play()
        } catch (e: Exception) { /* ignore */ }
        call.resolve()
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        try { currentRingtone?.stop() } catch (e: Exception) { /* ignore */ }
        currentRingtone = null
        call.resolve()
    }

    @PluginMethod
    fun playLoud(call: PluginCall) {
        try {
            // Use ToneGenerator on STREAM_ALARM - always audible even on silent
            val tg = ToneGenerator(AudioManager.STREAM_ALARM, 100)
            // Play 3 short beeps
            tg.startTone(ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD, 1500)
            Handler(Looper.getMainLooper()).postDelayed({ tg.release() }, 2000)
        } catch (e: Exception) { /* ignore */ }
        call.resolve()
    }

    @PluginMethod
    fun pick(call: PluginCall) {
        val ret = JSObject()
        ret.put("uri", null as String?)
        ret.put("cancelled", true)
        call.resolve(ret)
    }

    @PluginMethod
    fun getDefault(call: PluginCall) {
        val ret = JSObject()
        try {
            val uri = RingtoneManager.getActualDefaultRingtoneUri(context, RingtoneManager.TYPE_NOTIFICATION)
            ret.put("uri", uri?.toString())
        } catch (e: Exception) {
            ret.put("uri", null as String?)
        }
        call.resolve(ret)
    }
}
KTEOF

echo "Plugin written"

# Modify MainActivity using Python (more reliable than sed)
python3 << 'PYEOF'
import os

path = "android/app/src/main/java/com/matchreport/app/MainActivity.java"
if not os.path.exists(path):
    print(f"WARNING: {path} not found")
    exit(0)

content = open(path).read()

if "RingtonePlugin" in content:
    print("RingtonePlugin already registered")
    exit(0)

# Add import
content = content.replace(
    "import com.getcapacitor.BridgeActivity;",
    "import com.getcapacitor.BridgeActivity;\nimport com.matchreport.app.ringtones.RingtonePlugin;"
)

# Add plugin registration
if "onCreate" not in content:
    content = content.replace(
        "public class MainActivity extends BridgeActivity {}",
        """public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(RingtonePlugin.class);
        super.onCreate(savedInstanceState);
    }
}"""
    )
    # If one-liner format didn't match, try multi-line
    if "registerPlugin" not in content:
        content = content.replace(
            "public class MainActivity extends BridgeActivity {\n}",
            """public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(RingtonePlugin.class);
        super.onCreate(savedInstanceState);
    }
}"""
        )

open(path, 'w').write(content)
print("MainActivity updated")
PYEOF

echo "=== Plugin injection complete ==="
