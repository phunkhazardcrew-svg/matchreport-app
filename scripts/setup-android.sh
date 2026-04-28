#!/bin/bash
set -e
echo "=== Injecting Ringtone Plugin + ForegroundService ==="

PLUGIN_DIR="android/app/src/main/java/com/matchreport/app/ringtones"
mkdir -p "$PLUGIN_DIR"
rm -f "$PLUGIN_DIR/RingtonePlugin.kt"

##############################################
# 1. RingtonePlugin.java
##############################################
cat > "$PLUGIN_DIR/RingtonePlugin.java" << 'JAVAEOF'
package com.matchreport.app.ringtones;

import android.content.ContentUris;
import android.content.Intent;
import android.database.Cursor;
import android.media.AudioManager;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.media.ToneGenerator;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

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
        } catch (Exception e) { }
        JSObject ret = new JSObject();
        ret.put("ringtones", arr);
        call.resolve(ret);
    }

    @PluginMethod
    public void play(PluginCall call) {
        String uriStr = call.getString("uri");
        if (uriStr == null) { call.reject("Missing uri"); return; }
        try {
            if (currentRingtone != null) currentRingtone.stop();
            currentRingtone = RingtoneManager.getRingtone(getContext(), Uri.parse(uriStr));
            if (currentRingtone != null) currentRingtone.play();
        } catch (Exception e) { }
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
            ToneGenerator tg = new ToneGenerator(AudioManager.STREAM_ALARM, 100);
            tg.startTone(ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD, 1500);
            new Handler(Looper.getMainLooper()).postDelayed(tg::release, 2000);
        } catch (Exception e) { }
        call.resolve();
    }

    @PluginMethod
    public void startGame(PluginCall call) {
        try {
            Intent intent = new Intent(getContext(), MatchForegroundService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(intent);
            } else {
                getContext().startService(intent);
            }
        } catch (Exception e) { }
        call.resolve();
    }

    @PluginMethod
    public void stopGame(PluginCall call) {
        try {
            getContext().stopService(new Intent(getContext(), MatchForegroundService.class));
        } catch (Exception e) { }
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
        } catch (Exception e) { ret.put("uri", (String) null); }
        call.resolve(ret);
    }
}
JAVAEOF

##############################################
# 2. MatchForegroundService.java
##############################################
cat > "$PLUGIN_DIR/MatchForegroundService.java" << 'SVCEOF'
package com.matchreport.app.ringtones;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

public class MatchForegroundService extends Service {
    private static final String CHANNEL_ID = "matchreport_game";
    private static final int NOTIF_ID = 1001;
    private PowerManager.WakeLock wakeLock;

    @Override
    public void onCreate() {
        super.onCreate();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "Spieltimer", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Hält den Timer am Laufen");
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(ch);
        }
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "matchreport:game");
            wakeLock.acquire(6 * 60 * 60 * 1000L);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Intent ni = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent pi = PendingIntent.getActivity(this, 0, ni, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification n = null;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            n = new Notification.Builder(this, CHANNEL_ID)
                .setContentTitle("⚽ Matchreport")
                .setContentText("Spiel läuft — Timer aktiv")
                .setSmallIcon(android.R.drawable.ic_media_play)
                .setContentIntent(pi)
                .setOngoing(true)
                .build();
        }
        if (n != null) startForeground(NOTIF_ID, n);
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
SVCEOF

##############################################
# 3. Register plugin in MainActivity
##############################################
python3 << 'PYEOF'
import os
path = "android/app/src/main/java/com/matchreport/app/MainActivity.java"
if not os.path.exists(path):
    print("MainActivity not found"); exit(0)
c = open(path).read()
if "RingtonePlugin" in c:
    print("Already registered"); exit(0)
c = c.replace(
    "import com.getcapacitor.BridgeActivity;",
    "import com.getcapacitor.BridgeActivity;\nimport com.matchreport.app.ringtones.RingtonePlugin;")
c = c.replace(
    "public class MainActivity extends BridgeActivity {}",
    "public class MainActivity extends BridgeActivity {\n    @Override\n    public void onCreate(android.os.Bundle savedInstanceState) {\n        registerPlugin(RingtonePlugin.class);\n        super.onCreate(savedInstanceState);\n    }\n}")
open(path, 'w').write(c)
print("MainActivity updated")
PYEOF

##############################################
# 4. Add permissions + service to AndroidManifest
##############################################
python3 << 'PYEOF'
import os
path = "android/app/src/main/AndroidManifest.xml"
if not os.path.exists(path):
    print("Manifest not found"); exit(0)
c = open(path).read()
perms = """    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
"""
svc = '        <service android:name="com.matchreport.app.ringtones.MatchForegroundService" android:foregroundServiceType="mediaPlayback" android:exported="false" />\n'
if "FOREGROUND_SERVICE" not in c:
    c = c.replace("<application", perms + "    <application")
    print("Permissions added")
if "MatchForegroundService" not in c:
    c = c.replace("</application>", svc + "    </application>")
    print("Service declared")
open(path, 'w').write(c)
PYEOF

echo "=== Plugin + ForegroundService injection complete ==="
