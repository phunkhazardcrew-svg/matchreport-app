import os

D = "android/app/src/main/java/com/matchreport/app/ringtones"

###############################################
# 1. RingtonePlugin.java — unchanged from v3.4
###############################################
PLUGIN = '''package com.matchreport.app.ringtones;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.ContentUris;
import android.content.Context;
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
import android.provider.Settings;
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

    @PluginMethod public void play(PluginCall call) {
        String uriStr = call.getString("uri");
        if (uriStr == null) { call.reject("Missing uri"); return; }
        try { if (currentRingtone != null) currentRingtone.stop();
            currentRingtone = RingtoneManager.getRingtone(getContext(), Uri.parse(uriStr));
            if (currentRingtone != null) currentRingtone.play();
        } catch (Exception e) { }
        call.resolve();
    }

    @PluginMethod public void stop(PluginCall call) {
        try { if (currentRingtone != null) currentRingtone.stop(); } catch (Exception e) { }
        currentRingtone = null; call.resolve();
    }

    @PluginMethod public void playLoud(PluginCall call) {
        try { ToneGenerator tg = new ToneGenerator(AudioManager.STREAM_ALARM, 100);
            tg.startTone(ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD, 1500);
            new Handler(Looper.getMainLooper()).postDelayed(tg::release, 2000);
        } catch (Exception e) { }
        call.resolve();
    }

    @PluginMethod public void setAlarmConfig(PluginCall call) {
        int toneSec = call.getInt("toneSec", 5);
        int vibSec = call.getInt("vibSec", 5);
        getContext().getSharedPreferences("matchreport_alarm", Context.MODE_PRIVATE)
            .edit().putInt("toneSec", toneSec).putInt("vibSec", vibSec).apply();
        call.resolve();
    }

    @PluginMethod public void scheduleAlarm(PluginCall call) {
        double triggerAt = call.getDouble("triggerAt", 0.0);
        if (triggerAt <= 0) { call.reject("Missing triggerAt"); return; }
        try {
            AlarmManager am = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
            Intent intent = new Intent(getContext(), AlarmReceiver.class);
            PendingIntent alarmPi = PendingIntent.getBroadcast(getContext(), 9999, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            Intent showIntent = getContext().getPackageManager().getLaunchIntentForPackage(getContext().getPackageName());
            PendingIntent showPi = PendingIntent.getActivity(getContext(), 0, showIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            AlarmManager.AlarmClockInfo info = new AlarmManager.AlarmClockInfo((long) triggerAt, showPi);
            am.setAlarmClock(info, alarmPi);
            getContext().getSharedPreferences("matchreport_alarm", Context.MODE_PRIVATE)
                .edit().putLong("triggerAt", (long) triggerAt).apply();
        } catch (Exception e) { }
        call.resolve();
    }

    @PluginMethod public void cancelAlarm(PluginCall call) {
        try {
            AlarmManager am = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
            Intent intent = new Intent(getContext(), AlarmReceiver.class);
            PendingIntent pi = PendingIntent.getBroadcast(getContext(), 9999, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            am.cancel(pi);
            getContext().getSharedPreferences("matchreport_alarm", Context.MODE_PRIVATE)
                .edit().remove("triggerAt").apply();
        } catch (Exception e) { }
        call.resolve();
    }

    @PluginMethod public void startGame(PluginCall call) {
        try { Intent i = new Intent(getContext(), MatchForegroundService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) getContext().startForegroundService(i);
            else getContext().startService(i);
        } catch (Exception e) { }
        call.resolve();
    }

    @PluginMethod public void stopGame(PluginCall call) {
        try { getContext().stopService(new Intent(getContext(), MatchForegroundService.class)); }
        catch (Exception e) { }
        call.resolve();
    }

    @PluginMethod public void requestBatteryExempt(PluginCall call) {
        try {
            android.os.PowerManager pm = (android.os.PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
            if (pm != null && !pm.isIgnoringBatteryOptimizations(getContext().getPackageName())) {
                Intent i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                i.setData(Uri.parse("package:" + getContext().getPackageName()));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(i);
            }
        } catch (Exception e) { }
        call.resolve();
    }

    @PluginMethod public void pick(PluginCall call) {
        JSObject ret = new JSObject(); ret.put("uri", (String) null); ret.put("cancelled", true); call.resolve(ret);
    }

    @PluginMethod public void getDefault(PluginCall call) {
        JSObject ret = new JSObject();
        try { Uri uri = RingtoneManager.getActualDefaultRingtoneUri(getContext(), RingtoneManager.TYPE_NOTIFICATION);
            ret.put("uri", uri != null ? uri.toString() : null);
        } catch (Exception e) { ret.put("uri", (String) null); }
        call.resolve(ret);
    }
}
'''
open(f"{D}/RingtonePlugin.java", "w").write(PLUGIN)
print("1/6 RingtonePlugin.java")


###############################################
# 2. AlarmReceiver.java
# CRITICAL FIX: Don't play sound here!
# Just start AlarmPlaybackService immediately.
# BroadcastReceiver has 10s limit — not enough for 60s+ tones.
###############################################
RECEIVER = '''package com.matchreport.app.ringtones;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.PowerManager;

public class AlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        // Acquire WakeLock IMMEDIATELY to prevent CPU from sleeping
        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock wl = null;
        if (pm != null) {
            wl = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "matchreport:alarm_receiver");
            wl.acquire(5000); // Hold 5 seconds — enough to start service
        }

        // Start AlarmPlaybackService — this is a foreground service
        // that can play tone + vibrate for up to 120 seconds
        // DO NOT play sound here — BroadcastReceiver has 10s execution limit!
        try {
            Intent serviceIntent = new Intent(context, AlarmPlaybackService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent);
            } else {
                context.startService(serviceIntent);
            }
        } catch (Exception e) { }

        // Clear trigger time so backup timer doesn't double-fire
        try {
            context.getSharedPreferences("matchreport_alarm", Context.MODE_PRIVATE)
                .edit().remove("triggerAt").apply();
        } catch (Exception e) { }

        // WakeLock will be released automatically after 5s
    }
}
'''
open(f"{D}/AlarmReceiver.java", "w").write(RECEIVER)
print("2/6 AlarmReceiver.java (starts service, no direct playback)")


###############################################
# 3. AlarmPlaybackService.java — NEW
# Dedicated foreground service for alarm playback.
# Has its own notification, WakeLock, AudioFocus.
# Can play for up to 120 seconds without being killed.
###############################################
PLAYBACK = '''package com.matchreport.app.ringtones;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.Vibrator;

public class AlarmPlaybackService extends Service {
    private static final String CHANNEL_ID = "matchreport_alarm_channel";
    private PowerManager.WakeLock wakeLock;
    private ToneGenerator toneGenerator;
    private Handler handler;

    @Override
    public void onCreate() {
        super.onCreate();
        // Create high-priority notification channel for alarm
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(
                CHANNEL_ID, "Spielalarm", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("Halbzeit- und Spielende-Signal");
            ch.enableVibration(true);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(ch);
        }
        handler = new Handler(Looper.getMainLooper());
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // Show foreground notification immediately
        Intent ni = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent pi = PendingIntent.getActivity(this, 0, ni,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification n = new Notification.Builder(this, CHANNEL_ID)
                .setContentTitle("SCHLUSSPFIFF!")
                .setContentText("Halbzeit / Spielende")
                .setSmallIcon(android.R.drawable.ic_dialog_alert)
                .setContentIntent(pi)
                .setAutoCancel(true)
                .build();
            startForeground(2002, n);
        }

        // Acquire WakeLock for the entire playback duration
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "matchreport:alarm_play");
            wakeLock.acquire(130 * 1000L); // 130 seconds max
        }

        // Read configured durations
        SharedPreferences prefs = getSharedPreferences("matchreport_alarm", Context.MODE_PRIVATE);
        int toneSec = prefs.getInt("toneSec", 5);
        int vibSec = prefs.getInt("vibSec", 5);

        // Request audio focus — PAUSES YouTube, Spotify, STT, everything
        AudioManager audioMgr = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        if (audioMgr != null) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                AudioFocusRequest focusReq = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
                    .setAudioAttributes(new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build())
                    .build();
                audioMgr.requestAudioFocus(focusReq);
            } else {
                audioMgr.requestAudioFocus(null, AudioManager.STREAM_ALARM,
                    AudioManager.AUDIOFOCUS_GAIN_TRANSIENT);
            }
        }

        // Play tone on STREAM_ALARM (ignores silent mode)
        if (toneSec > 0) {
            try {
                toneGenerator = new ToneGenerator(AudioManager.STREAM_ALARM, 100);
                // Play repeating tones for the configured duration
                int toneMs = toneSec * 1000;
                int interval = 800; // 800ms per beep cycle
                int repeats = toneMs / interval;
                for (int i = 0; i < repeats; i++) {
                    final int delay = i * interval;
                    handler.postDelayed(() -> {
                        try { toneGenerator.startTone(ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD, 500); }
                        catch (Exception e) { }
                    }, delay);
                }
            } catch (Exception e) { }
        }

        // Vibrate for configured duration
        if (vibSec > 0) {
            try {
                Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
                if (v != null) {
                    int cycles = (vibSec * 1000) / 800;
                    long[] pattern = new long[cycles * 2 + 1];
                    pattern[0] = 0;
                    for (int i = 0; i < cycles * 2; i++) {
                        pattern[i + 1] = (i % 2 == 0) ? 500 : 300;
                    }
                    v.vibrate(pattern, -1);
                }
            } catch (Exception e) { }
        }

        // Auto-stop service after max(toneSec, vibSec) + 2 seconds
        int maxDuration = Math.max(toneSec, vibSec);
        handler.postDelayed(() -> {
            // Abandon audio focus
            if (audioMgr != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    // Just abandon with null — simple approach
                    audioMgr.abandonAudioFocus(null);
                } else {
                    audioMgr.abandonAudioFocus(null);
                }
            }
            stopSelf();
        }, (maxDuration + 2) * 1000L);

        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        if (toneGenerator != null) {
            try { toneGenerator.release(); } catch (Exception e) { }
        }
        if (handler != null) handler.removeCallbacksAndMessages(null);
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
'''
open(f"{D}/AlarmPlaybackService.java", "w").write(PLAYBACK)
print("3/6 AlarmPlaybackService.java (dedicated alarm foreground service)")


###############################################
# 4. MatchForegroundService.java
# Backup timer checks every 1 second (was 5)
# Also starts AlarmPlaybackService (not direct play)
###############################################
SERVICE = '''package com.matchreport.app.ringtones;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;

public class MatchForegroundService extends Service {
    private PowerManager.WakeLock wakeLock;
    private Handler timerHandler;
    private Runnable timerRunnable;
    private boolean alarmFired = false;

    @Override
    public void onCreate() {
        super.onCreate();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(
                "matchreport_game", "Spieltimer", NotificationManager.IMPORTANCE_LOW);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(ch);
        }
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "matchreport:game");
            wakeLock.acquire(6 * 60 * 60 * 1000L);
        }

        // Backup timer — checks EVERY 1 SECOND
        alarmFired = false;
        timerHandler = new Handler(Looper.getMainLooper());
        timerRunnable = new Runnable() {
            @Override
            public void run() {
                if (!alarmFired) {
                    SharedPreferences prefs = getSharedPreferences("matchreport_alarm", Context.MODE_PRIVATE);
                    long triggerAt = prefs.getLong("triggerAt", 0);
                    if (triggerAt > 0 && System.currentTimeMillis() >= triggerAt) {
                        alarmFired = true;
                        // Start AlarmPlaybackService (same as AlarmReceiver does)
                        try {
                            Intent si = new Intent(MatchForegroundService.this, AlarmPlaybackService.class);
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(si);
                            else startService(si);
                        } catch (Exception e) { }
                        prefs.edit().remove("triggerAt").apply();
                    }
                }
                timerHandler.postDelayed(this, 1000); // Every 1 second
            }
        };
        timerHandler.postDelayed(timerRunnable, 1000);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        alarmFired = false;
        Intent ni = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent pi = PendingIntent.getActivity(this, 0, ni,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification n = new Notification.Builder(this, "matchreport_game")
                .setContentTitle("Matchreport")
                .setContentText("Spiel laeuft - Timer aktiv")
                .setSmallIcon(android.R.drawable.ic_media_play)
                .setContentIntent(pi)
                .setOngoing(true)
                .build();
            startForeground(1001, n);
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        if (timerHandler != null && timerRunnable != null) timerHandler.removeCallbacks(timerRunnable);
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) { return null; }
}
'''
open(f"{D}/MatchForegroundService.java", "w").write(SERVICE)
print("4/6 MatchForegroundService.java (1s backup timer)")


###############################################
# 5. MainActivity
###############################################
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
            "    }\n}")
        open(path, 'w').write(c)
        print("5/6 MainActivity updated")
    else: print("5/6 MainActivity OK")


###############################################
# 6. AndroidManifest
###############################################
path = "android/app/src/main/AndroidManifest.xml"
if os.path.exists(path):
    c = open(path).read()
    for perm in ["FOREGROUND_SERVICE", "FOREGROUND_SERVICE_MEDIA_PLAYBACK",
                  "WAKE_LOCK", "SCHEDULE_EXACT_ALARM", "USE_EXACT_ALARM",
                  "VIBRATE", "REQUEST_IGNORE_BATTERY_OPTIMIZATIONS"]:
        full = f"android.permission.{perm}"
        if full not in c:
            c = c.replace("<application", f'    <uses-permission android:name="{full}" />\n<application')
    # Add all services + receiver
    if "AlarmPlaybackService" not in c:
        c = c.replace("</application>",
            '        <service android:name="com.matchreport.app.ringtones.MatchForegroundService" '
            'android:foregroundServiceType="mediaPlayback" android:exported="false" />\n'
            '        <service android:name="com.matchreport.app.ringtones.AlarmPlaybackService" '
            'android:foregroundServiceType="mediaPlayback" android:exported="false" />\n'
            '        <receiver android:name="com.matchreport.app.ringtones.AlarmReceiver" '
            'android:exported="false" />\n'
            '    </application>')
    open(path, 'w').write(c)
    print("6/6 AndroidManifest (AlarmPlaybackService added)")

print("\n=== ALL 5 MEASURES + PLAYBACK SERVICE IMPLEMENTED ===")
