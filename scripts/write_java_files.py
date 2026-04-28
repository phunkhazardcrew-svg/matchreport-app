import os

D = "android/app/src/main/java/com/matchreport/app/ringtones"

###############################################
# 1/3 RingtonePlugin.java
# - setAlarmClock() (Maßnahme 1)
# - setAlarmConfig (configurable durations)
# - startGame/stopGame (ForegroundService)
# - requestBatteryExempt (Maßnahme 4)
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

    // Maßnahme 4: Save alarm tone/vibration duration config
    @PluginMethod
    public void setAlarmConfig(PluginCall call) {
        int toneSec = call.getInt("toneSec", 5);
        int vibSec = call.getInt("vibSec", 5);
        getContext().getSharedPreferences("matchreport_alarm", Context.MODE_PRIVATE)
            .edit().putInt("toneSec", toneSec).putInt("vibSec", vibSec).apply();
        call.resolve();
    }

    // Maßnahme 1: Use setAlarmClock() — highest priority alarm in Android
    @PluginMethod
    public void scheduleAlarm(PluginCall call) {
        double triggerAt = call.getDouble("triggerAt", 0.0);
        if (triggerAt <= 0) { call.reject("Missing triggerAt"); return; }
        try {
            AlarmManager am = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
            Intent intent = new Intent(getContext(), AlarmReceiver.class);
            PendingIntent alarmPi = PendingIntent.getBroadcast(getContext(), 9999, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

            // Show intent: opens app when user taps alarm notification
            Intent showIntent = getContext().getPackageManager().getLaunchIntentForPackage(getContext().getPackageName());
            PendingIntent showPi = PendingIntent.getActivity(getContext(), 0, showIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

            // setAlarmClock = treated like a user-set alarm clock
            // Android exits Doze mode BEFORE this alarm fires
            // No manufacturer suppresses alarm clocks
            AlarmManager.AlarmClockInfo alarmInfo = new AlarmManager.AlarmClockInfo((long) triggerAt, showPi);
            am.setAlarmClock(alarmInfo, alarmPi);

            // Also save trigger time so ForegroundService backup timer can use it
            getContext().getSharedPreferences("matchreport_alarm", Context.MODE_PRIVATE)
                .edit().putLong("triggerAt", (long) triggerAt).apply();
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
            // Clear trigger time
            getContext().getSharedPreferences("matchreport_alarm", Context.MODE_PRIVATE)
                .edit().remove("triggerAt").apply();
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

    // Maßnahme 4: Request battery optimization exemption
    @PluginMethod
    public void requestBatteryExempt(PluginCall call) {
        try {
            android.os.PowerManager pm = (android.os.PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
            if (pm != null && !pm.isIgnoringBatteryOptimizations(getContext().getPackageName())) {
                Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
            }
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
'''
with open(f"{D}/RingtonePlugin.java", "w") as f:
    f.write(PLUGIN)
print("1/5 RingtonePlugin.java (setAlarmClock + requestBatteryExempt)")


###############################################
# 2/3 MatchForegroundService.java
# - Maßnahme 3: Own timer thread as backup
# - WakeLock
# - Permanent notification
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
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.Vibrator;

public class MatchForegroundService extends Service {
    private PowerManager.WakeLock wakeLock;
    private Handler timerHandler;
    private Runnable timerRunnable;
    private boolean alarmFired = false;

    @Override
    public void onCreate() {
        super.onCreate();
        // Create notification channel
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(
                "matchreport_game", "Spieltimer", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Haelt den Timer am Laufen");
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(ch);
        }
        // WakeLock: keep CPU alive (Maßnahme 2)
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "matchreport:game");
            wakeLock.acquire(6 * 60 * 60 * 1000L); // Max 6 hours
        }

        // Maßnahme 3: Backup timer thread
        // Checks every 5 seconds if alarm time has passed
        // Fires alarm independently of AlarmManager + WebView
        alarmFired = false;
        timerHandler = new Handler(Looper.getMainLooper());
        timerRunnable = new Runnable() {
            @Override
            public void run() {
                if (!alarmFired) {
                    SharedPreferences prefs = getSharedPreferences("matchreport_alarm", Context.MODE_PRIVATE);
                    long triggerAt = prefs.getLong("triggerAt", 0);
                    if (triggerAt > 0 && System.currentTimeMillis() >= triggerAt) {
                        // Alarm time reached! Fire backup alarm
                        alarmFired = true;
                        fireBackupAlarm();
                        prefs.edit().remove("triggerAt").apply();
                    }
                }
                timerHandler.postDelayed(this, 5000); // Check every 5 seconds
            }
        };
        timerHandler.postDelayed(timerRunnable, 5000);
    }

    private void fireBackupAlarm() {
        SharedPreferences prefs = getSharedPreferences("matchreport_alarm", Context.MODE_PRIVATE);
        int toneSec = prefs.getInt("toneSec", 5);
        int vibSec = prefs.getInt("vibSec", 5);

        // Maßnahme 5: Request audio focus to pause YouTube/Spotify/etc
        AudioManager audioMgr = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        if (audioMgr != null) {
            audioMgr.requestAudioFocus(null, AudioManager.STREAM_ALARM, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT);
        }

        // Play alarm tone on STREAM_ALARM (bypasses silent mode)
        if (toneSec > 0) {
            try {
                ToneGenerator tg = new ToneGenerator(AudioManager.STREAM_ALARM, 100);
                tg.startTone(ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD, toneSec * 1000);
                new Handler(Looper.getMainLooper()).postDelayed(() -> {
                    tg.release();
                    // Abandon audio focus after tone
                    if (audioMgr != null) audioMgr.abandonAudioFocus(null);
                }, (toneSec + 1) * 1000L);
            } catch (Exception e) { }
        }

        // Vibrate
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
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // Reset backup timer flag when service restarts
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
        if (timerHandler != null && timerRunnable != null) {
            timerHandler.removeCallbacks(timerRunnable);
        }
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
'''
with open(f"{D}/MatchForegroundService.java", "w") as f:
    f.write(SERVICE)
print("2/5 MatchForegroundService.java (backup timer + WakeLock)")


###############################################
# 3/3 AlarmReceiver.java
# - Maßnahme 2: WakeLock
# - Maßnahme 5: AudioFocus (pause YouTube etc)
# - Configurable tone/vibration duration
###############################################
RECEIVER = '''package com.matchreport.app.ringtones;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.os.Vibrator;

public class AlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        // Maßnahme 2: Acquire WakeLock to keep CPU alive during playback
        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock wl = null;
        if (pm != null) {
            wl = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "matchreport:alarm");
            wl.acquire(120 * 1000L); // Hold for max 120 seconds
        }

        // Read configured durations
        SharedPreferences prefs = context.getSharedPreferences("matchreport_alarm", Context.MODE_PRIVATE);
        int toneSec = prefs.getInt("toneSec", 5);
        int vibSec = prefs.getInt("vibSec", 5);

        // Maßnahme 5: Request audio focus — pauses YouTube, Spotify, voice recording
        AudioManager audioMgr = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
        if (audioMgr != null) {
            audioMgr.requestAudioFocus(null, AudioManager.STREAM_ALARM,
                AudioManager.AUDIOFOCUS_GAIN_TRANSIENT);
        }

        // Play alarm tone on STREAM_ALARM (ignores silent/vibrate mode)
        if (toneSec > 0) {
            try {
                ToneGenerator tg = new ToneGenerator(AudioManager.STREAM_ALARM, 100);
                tg.startTone(ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD, toneSec * 1000);
                final PowerManager.WakeLock finalWl = wl;
                new Handler(Looper.getMainLooper()).postDelayed(() -> {
                    tg.release();
                    // Abandon audio focus — YouTube/Spotify resume automatically
                    if (audioMgr != null) audioMgr.abandonAudioFocus(null);
                    // Release WakeLock
                    if (finalWl != null && finalWl.isHeld()) finalWl.release();
                }, (toneSec + 1) * 1000L);
            } catch (Exception e) {
                if (wl != null && wl.isHeld()) wl.release();
            }
        } else {
            // No tone — release immediately after vibration
            final PowerManager.WakeLock finalWl = wl;
            new Handler(Looper.getMainLooper()).postDelayed(() -> {
                if (audioMgr != null) audioMgr.abandonAudioFocus(null);
                if (finalWl != null && finalWl.isHeld()) finalWl.release();
            }, (vibSec + 1) * 1000L);
        }

        // Vibrate for configured duration (500ms on, 300ms off pattern)
        if (vibSec > 0) {
            try {
                Vibrator v = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
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

        // Clear trigger time so backup timer doesn't double-fire
        prefs.edit().remove("triggerAt").apply();
    }
}
'''
with open(f"{D}/AlarmReceiver.java", "w") as f:
    f.write(RECEIVER)
print("3/5 AlarmReceiver.java (WakeLock + AudioFocus + configurable)")


###############################################
# 4/5 Modify MainActivity.java
###############################################
path = "android/app/src/main/java/com/matchreport/app/MainActivity.java"
if os.path.exists(path):
    c = open(path).read()
    if "RingtonePlugin" not in c:
        c = c.replace(
            "import com.getcapacitor.BridgeActivity;",
            "import com.getcapacitor.BridgeActivity;\nimport com.matchreport.app.ringtones.RingtonePlugin;")
        c = c.replace(
            "public class MainActivity extends BridgeActivity {}",
            "public class MainActivity extends BridgeActivity {\n"
            "    @Override\n"
            "    public void onCreate(android.os.Bundle savedInstanceState) {\n"
            "        registerPlugin(RingtonePlugin.class);\n"
            "        super.onCreate(savedInstanceState);\n"
            "    }\n"
            "}")
        open(path, 'w').write(c)
        print("4/5 MainActivity updated")
    else:
        print("4/5 MainActivity already configured")


###############################################
# 5/5 Modify AndroidManifest.xml
###############################################
path = "android/app/src/main/AndroidManifest.xml"
if os.path.exists(path):
    c = open(path).read()
    perms_needed = [
        "android.permission.FOREGROUND_SERVICE",
        "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
        "android.permission.WAKE_LOCK",
        "android.permission.SCHEDULE_EXACT_ALARM",
        "android.permission.USE_EXACT_ALARM",
        "android.permission.VIBRATE",
        "android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS",
    ]
    for perm in perms_needed:
        if perm not in c:
            c = c.replace("<application",
                f'    <uses-permission android:name="{perm}" />\n<application')
    if "MatchForegroundService" not in c:
        c = c.replace("</application>",
            '        <service android:name="com.matchreport.app.ringtones.MatchForegroundService" '
            'android:foregroundServiceType="mediaPlayback" android:exported="false" />\n'
            '        <receiver android:name="com.matchreport.app.ringtones.AlarmReceiver" '
            'android:exported="false" />\n'
            '    </application>')
    open(path, 'w').write(c)
    print("5/5 AndroidManifest updated (all permissions)")

print("\n=== All 5 measures implemented ===")
