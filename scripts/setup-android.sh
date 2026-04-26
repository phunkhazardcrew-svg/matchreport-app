#!/bin/bash
# Setup custom Android plugins after Capacitor generates the android/ directory
set -e

ANDROID_DIR="android/app/src/main/java/com/matchreport/app"
PLUGIN_DIR="$ANDROID_DIR/ringtones"

echo "=== Setting up custom Android plugins ==="

# Create plugin directory
mkdir -p "$PLUGIN_DIR"

# Write RingtonePlugin.kt
cat > "$PLUGIN_DIR/RingtonePlugin.kt" << 'KTEOF'
package com.matchreport.app.ringtones

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.media.RingtoneManager
import android.net.Uri
import androidx.activity.result.ActivityResult
import com.getcapacitor.*
import com.getcapacitor.annotation.*

@CapacitorPlugin(
    name = "Ringtones",
    permissions = [Permission(alias = "audio", strings = [
        Manifest.permission.READ_MEDIA_AUDIO
    ])]
)
class RingtonePlugin : Plugin() {
    private val impl by lazy { RingtoneImpl(context) }

    @PluginMethod
    fun list(call: PluginCall) {
        val type = typeFlag(call.getString("type", "all") ?: "all")
        val items = impl.list(type)
        val arr = JSArray()
        items.forEach { arr.put(JSObject().apply { put("title", it.title); put("uri", it.uri) }) }
        call.resolve(JSObject().apply { put("ringtones", arr) })
    }

    @PluginMethod
    fun play(call: PluginCall) {
        val uri = call.getString("uri") ?: return call.reject("Missing 'uri'")
        impl.play(Uri.parse(uri))
        call.resolve()
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        impl.stop()
        call.resolve()
    }

    @PluginMethod
    fun getDefault(call: PluginCall) {
        val type = typeFlag(call.getString("type", "notification") ?: "notification")
        val uri = RingtoneManager.getActualDefaultRingtoneUri(context, type)
        call.resolve(JSObject().apply { put("uri", uri?.toString()) })
    }

    @PluginMethod
    fun pick(call: PluginCall) {
        val type = typeFlag(call.getString("type", "notification") ?: "notification")
        val intent = Intent(RingtoneManager.ACTION_RINGTONE_PICKER).apply {
            putExtra(RingtoneManager.EXTRA_RINGTONE_TYPE, type)
            putExtra(RingtoneManager.EXTRA_RINGTONE_TITLE, call.getString("title", "Sound auswählen"))
            putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_DEFAULT, true)
            putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_SILENT, true)
            call.getString("existingUri")?.let {
                putExtra(RingtoneManager.EXTRA_RINGTONE_EXISTING_URI, Uri.parse(it))
            }
        }
        startActivityForResult(call, intent, "pickResult")
    }

    @ActivityCallback
    private fun pickResult(call: PluginCall, result: ActivityResult) {
        val ret = JSObject()
        if (result.resultCode == Activity.RESULT_OK) {
            val uri: Uri? = result.data?.getParcelableExtra(RingtoneManager.EXTRA_RINGTONE_PICKED_URI)
            ret.put("uri", uri?.toString())
            ret.put("cancelled", false)
        } else {
            ret.put("uri", null)
            ret.put("cancelled", true)
        }
        call.resolve(ret)
    }

    private fun typeFlag(s: String) = when (s.lowercase()) {
        "ringtone" -> RingtoneManager.TYPE_RINGTONE
        "notification" -> RingtoneManager.TYPE_NOTIFICATION
        "alarm" -> RingtoneManager.TYPE_ALARM
        else -> RingtoneManager.TYPE_ALL
    }
}
KTEOF

# Write RingtoneImpl.kt
cat > "$PLUGIN_DIR/RingtoneImpl.kt" << 'KTEOF2'
package com.matchreport.app.ringtones

import android.content.ContentUris
import android.content.Context
import android.media.Ringtone
import android.media.RingtoneManager
import android.net.Uri

data class RingtoneInfo(val title: String, val uri: String)

class RingtoneImpl(private val context: Context) {
    private var current: Ringtone? = null

    fun list(type: Int): List<RingtoneInfo> {
        val mgr = RingtoneManager(context).apply { setType(type) }
        val cursor = mgr.cursor
        val out = mutableListOf<RingtoneInfo>()
        while (cursor.moveToNext()) {
            val title = cursor.getString(RingtoneManager.TITLE_COLUMN_INDEX)
            val baseUri = cursor.getString(RingtoneManager.URI_COLUMN_INDEX)
            val id = cursor.getLong(RingtoneManager.ID_COLUMN_INDEX)
            out += RingtoneInfo(title, ContentUris.withAppendedId(Uri.parse(baseUri), id).toString())
        }
        return out
    }

    fun play(uri: Uri) {
        stop()
        current = RingtoneManager.getRingtone(context, uri)
        current?.play()
    }

    fun stop() {
        current?.let { if (it.isPlaying) it.stop() }
        current = null
    }
}
KTEOF2

# Register plugin in MainActivity
MAIN_ACTIVITY="android/app/src/main/java/com/matchreport/app/MainActivity.java"
if [ -f "$MAIN_ACTIVITY" ]; then
  # Check if already registered
  if ! grep -q "RingtonePlugin" "$MAIN_ACTIVITY"; then
    sed -i 's/import com.getcapacitor.BridgeActivity;/import com.getcapacitor.BridgeActivity;\nimport com.matchreport.app.ringtones.RingtonePlugin;/' "$MAIN_ACTIVITY"
    sed -i 's/public class MainActivity extends BridgeActivity {/public class MainActivity extends BridgeActivity {\n    @Override\n    protected void onCreate(android.os.Bundle savedInstanceState) {\n        registerPlugin(RingtonePlugin.class);\n        super.onCreate(savedInstanceState);\n    }/' "$MAIN_ACTIVITY"
    echo "Registered RingtonePlugin in MainActivity"
  else
    echo "RingtonePlugin already registered"
  fi
else
  echo "WARNING: MainActivity.java not found at $MAIN_ACTIVITY — will be created by cap add android"
fi

# Add audio permission to AndroidManifest
MANIFEST="android/app/src/main/AndroidManifest.xml"
if [ -f "$MANIFEST" ]; then
  if ! grep -q "READ_MEDIA_AUDIO" "$MANIFEST"; then
    sed -i 's/<application/<uses-permission android:name="android.permission.READ_MEDIA_AUDIO" \/>\n    <application/' "$MANIFEST"
    echo "Added READ_MEDIA_AUDIO permission"
  fi
fi

echo "=== Android setup complete ==="
