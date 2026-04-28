import os

D = "android/app/src/main/java/com/matchreport/app/ringtones"

###############################################
# 1. RingtonePlugin.java
###############################################
PLUGIN = """package com.matchreport.app.ringtones;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.ContentUris;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.media.AudioManager;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.media.ToneGenerator;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import com.getcapacitor.*;
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
    public void scheduleAlarm(PluginCall call) {
        double triggerAt = call.getDouble("triggerAt", 0.0);
        if (triggerAt <= 0) { call.reject("Missing triggerAt"); return; }
        int toneDur = call.getInt("toneDuration", 5);
        int vibDur = call.getInt("vibDuration", 60);
        // Save durations so AlarmReceiver can read them
        getContext().getSharedPreferences("matchreport_alarm", Context.MODE_PRIVATE)
            .edit().putInt("toneDuration", toneDur).putInt("vibDuration", vibDur).apply();
        try {
            AlarmManager am = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
            Intent intent = new Intent(getContext(), AlarmReceiver.class);
            PendingIntent pi = PendingIntent.getBroadcast(getContext(), 9999, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, (long) triggerAt, pi);
            } else {
                am.setExact(AlarmManager.RTC_WAKEUP, (long) triggerAt, pi);
            }
        } catch (Exception e) { }
        call.resolve();
    }

    @PluginMethod
    public void cancelAlarm(PluginCall call) {
        try {
            AlarmManager am = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
            Intent intent = new Intent(getContext(), AlarmReceiver.class);
            PendingIntent pi = PendingIntent.getBroadcast(getContext(), 9999, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            am.cancel(pi);
        } catch (Exception e) { }
        call.resolve();
    }

    @PluginMethod
    public void startGame(PluginCall call) {
        try {
            Intent intent = new Intent(getContext(), MatchForegroundService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(intent);
            } else { getContext().startService(intent); }
        } catch (Exception e) { }
        call.resolve();
    }

    @PluginMethod
    public void stopGame(PluginCall call) {
        try { getContext().stopService(new Intent(getContext(), MatchForegroundService.class)); }
        catch (Exception e) { }
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
"""

###############################################
# 2. MatchForegroundService.java
###############################################
SERVICE = """package com.matchreport.app.ringtones;

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
    private PowerManager.WakeLock wakeLock;

    @Override
    public void onCreate() {
        super.onCreate();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel("matchreport_game", "Spieltimer", NotificationManager.IMPORTANCE_LOW);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(ch);
        }
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null) { wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "matchreport:game"); wakeLock.acquire(6*60*60*1000L); }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Intent ni = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent pi = PendingIntent.getActivity(this, 0, ni, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification n = new Notification.Builder(this, "matchreport_game")
                .setContentTitle("Matchreport").setContentText("Spiel laeuft")
                .setSmallIcon(android.R.drawable.ic_media_play).setContentIntent(pi).setOngoing(true).build();
            startForeground(1001, n);
        }
        return START_STICKY;
    }

    @Override public void onDestroy() { if (wakeLock != null && wakeLock.isHeld()) wakeLock.release(); super.onDestroy(); }
    @Override public IBinder onBind(Intent intent) { return null; }
}
"""

###############################################
# 3. AlarmReceiver.java — reads durations from SharedPreferences
###############################################
RECEIVER = """package com.matchreport.app.ringtones;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.os.Handler;
import android.os.Looper;
import android.os.Vibrator;

public class AlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        SharedPreferences prefs = context.getSharedPreferences("matchreport_alarm", Context.MODE_PRIVATE);
        int toneSec = prefs.getInt("toneDuration", 5);
        int vibSec = prefs.getInt("vibDuration", 60);

        // Play tone on STREAM_ALARM (bypasses silent mode)
        if (toneSec > 0) {
            try {
                ToneGenerator tg = new ToneGenerator(AudioManager.STREAM_ALARM, 100);
                tg.startTone(ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD, toneSec * 1000);
                new Handler(Looper.getMainLooper()).postDelayed(tg::release, (toneSec + 1) * 1000L);
            } catch (Exception e) { }
        }

        // Vibrate with pattern
        if (vibSec > 0) {
            try {
                Vibrator v = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
                if (v != null) {
                    // Pattern: 500ms on, 300ms off, repeating for vibSec seconds
                    int cycles = (vibSec * 1000) / 800;
                    long[] pattern = new long[cycles * 2 + 1];
                    pattern[0] = 0; // start immediately
                    for (int i = 0; i < cycles; i++) {
                        pattern[i * 2 + 1] = 500; // vibrate
                        pattern[i * 2 + 2] = 300; // pause
                    }
                    v.vibrate(pattern, -1);
                }
            } catch (Exception e) { }
        }
    }
}
"""

# Write all Java files
open(f"{D}/RingtonePlugin.java", "w").write(PLUGIN)
print("1/5 RingtonePlugin.java")
open(f"{D}/MatchForegroundService.java", "w").write(SERVICE)
print("2/5 MatchForegroundService.java")
open(f"{D}/AlarmReceiver.java", "w").write(RECEIVER)
print("3/5 AlarmReceiver.java")

# 4. MainActivity
path = "android/app/src/main/java/com/matchreport/app/MainActivity.java"
if os.path.exists(path):
    c = open(path).read()
    if "RingtonePlugin" not in c:
        c = c.replace("import com.getcapacitor.BridgeActivity;",
            "import com.getcapacitor.BridgeActivity;\nimport com.matchreport.app.ringtones.RingtonePlugin;")
        c = c.replace("public class MainActivity extends BridgeActivity {}",
            "public class MainActivity extends BridgeActivity {\n"
            "    @Override\n"
            "    public void onCreate(android.os.Bundle savedInstanceState) {\n"
            "        registerPlugin(RingtonePlugin.class);\n"
            "        super.onCreate(savedInstanceState);\n"
            "    }\n"
            "}")
        open(path, 'w').write(c)
        print("4/5 MainActivity updated")
    else: print("4/5 MainActivity OK")

# 5. AndroidManifest
path = "android/app/src/main/AndroidManifest.xml"
if os.path.exists(path):
    c = open(path).read()
    if "FOREGROUND_SERVICE" not in c:
        c = c.replace("<application",
            '<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />\n'
            '    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />\n'
            '    <uses-permission android:name="android.permission.WAKE_LOCK" />\n'
            '    <uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />\n'
            '    <uses-permission android:name="android.permission.VIBRATE" />\n'
            '    <application')
    if "MatchForegroundService" not in c:
        c = c.replace("</application>",
            '        <service android:name="com.matchreport.app.ringtones.MatchForegroundService" '
            'android:foregroundServiceType="mediaPlayback" android:exported="false" />\n'
            '        <receiver android:name="com.matchreport.app.ringtones.AlarmReceiver" '
            'android:exported="false" />\n'
            '    </application>')
    open(path, 'w').write(c)
    print("5/5 AndroidManifest updated")
