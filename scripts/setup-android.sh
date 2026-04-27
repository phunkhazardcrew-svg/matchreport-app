#!/bin/bash
set -e
echo "=== Injecting Ringtone Plugin ==="

ANDROID_DIR="android/app/src/main/java/com/matchreport/app"
PLUGIN_DIR="$ANDROID_DIR/ringtones"
mkdir -p "$PLUGIN_DIR"

# Minimal plugin: list, play, stop, playLoud (STREAM_ALARM)
cat > "$PLUGIN_DIR/RingtonePlugin.kt" << 'KTEOF'
package com.matchreport.app.ringtones

import android.content.ContentUris
import android.content.Context
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.Ringtone
import android.media.RingtoneManager
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
    private var loudPlayer: MediaPlayer? = null

    @PluginMethod
    fun list(call: PluginCall) {
        try {
            val typeStr = call.getString("type", "all") ?: "all"
            val type = when (typeStr.lowercase()) {
                "ringtone" -> RingtoneManager.TYPE_RINGTONE
                "notification" -> RingtoneManager.TYPE_NOTIFICATION
                "alarm" -> RingtoneManager.TYPE_ALARM
                else -> RingtoneManager.TYPE_ALL
            }
            val mgr = RingtoneManager(context)
            mgr.setType(type)
            val cursor = mgr.cursor
            val arr = JSArray()
            while (cursor.moveToNext()) {
                val title = cursor.getString(RingtoneManager.TITLE_COLUMN_INDEX)
                val baseUri = cursor.getString(RingtoneManager.URI_COLUMN_INDEX)
                val id = cursor.getLong(RingtoneManager.ID_COLUMN_INDEX)
                val uri = ContentUris.withAppendedId(Uri.parse(baseUri), id).toString()
                val obj = JSObject()
                obj.put("title", title)
                obj.put("uri", uri)
                arr.put(obj)
            }
            val ret = JSObject()
            ret.put("ringtones", arr)
            call.resolve(ret)
        } catch (e: Exception) {
            val ret = JSObject()
            ret.put("ringtones", JSArray())
            call.resolve(ret)
        }
    }

    @PluginMethod
    fun play(call: PluginCall) {
        val uriStr = call.getString("uri") ?: return call.reject("Missing uri")
        try {
            stopAll()
            currentRingtone = RingtoneManager.getRingtone(context, Uri.parse(uriStr))
            currentRingtone?.play()
            call.resolve()
        } catch (e: Exception) {
            call.reject("play failed: ${e.message}")
        }
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        stopAll()
        call.resolve()
    }

    @PluginMethod
    fun playLoud(call: PluginCall) {
        try {
            stopAll()
            val am = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager

            // Get a sound URI - use provided or default notification
            val uriStr = call.getString("uri")
            val soundUri = if (uriStr != null) {
                Uri.parse(uriStr)
            } else {
                RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
                    ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            }

            if (soundUri == null) {
                call.reject("No sound URI available")
                return
            }

            // Use MediaPlayer with USAGE_ALARM to bypass silent mode
            loudPlayer = MediaPlayer().apply {
                setDataSource(context, soundUri)
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                // Set volume to max
                setVolume(1.0f, 1.0f)
                prepare()
                start()
            }

            // Auto-stop after 3 seconds
            Handler(Looper.getMainLooper()).postDelayed({
                try {
                    loudPlayer?.stop()
                    loudPlayer?.release()
                    loudPlayer = null
                } catch (_: Exception) {}
            }, 3000)

            call.resolve()
        } catch (e: Exception) {
            call.reject("playLoud failed: ${e.message}")
        }
    }

    @PluginMethod
    fun pick(call: PluginCall) {
        // Simplified: return cancelled on web, native picker needs activity result
        val ret = JSObject()
        ret.put("uri", null)
        ret.put("cancelled", true)
        call.resolve(ret)
    }

    @PluginMethod
    fun getDefault(call: PluginCall) {
        try {
            val uri = RingtoneManager.getActualDefaultRingtoneUri(
                context, RingtoneManager.TYPE_NOTIFICATION
            )
            val ret = JSObject()
            ret.put("uri", uri?.toString())
            call.resolve(ret)
        } catch (e: Exception) {
            val ret = JSObject()
            ret.put("uri", null)
            call.resolve(ret)
        }
    }

    private fun stopAll() {
        try { currentRingtone?.stop() } catch (_: Exception) {}
        currentRingtone = null
        try { loudPlayer?.stop(); loudPlayer?.release() } catch (_: Exception) {}
        loudPlayer = null
    }
}
KTEOF

echo "Plugin written: $PLUGIN_DIR/RingtonePlugin.kt"

# Register plugin in MainActivity
MAIN_ACTIVITY="android/app/src/main/java/com/matchreport/app/MainActivity.java"
if [ -f "$MAIN_ACTIVITY" ]; then
  if ! grep -q "RingtonePlugin" "$MAIN_ACTIVITY"; then
    sed -i 's/import com.getcapacitor.BridgeActivity;/import com.getcapacitor.BridgeActivity;\nimport com.matchreport.app.ringtones.RingtonePlugin;/' "$MAIN_ACTIVITY"
    sed -i '/public class MainActivity/a\    @Override\n    protected void onCreate(android.os.Bundle savedInstanceState) {\n        registerPlugin(RingtonePlugin.class);\n        super.onCreate(savedInstanceState);\n    }' "$MAIN_ACTIVITY"
    echo "Registered RingtonePlugin in MainActivity"
  else
    echo "RingtonePlugin already registered"
  fi
fi

echo "=== Plugin injection complete ==="
