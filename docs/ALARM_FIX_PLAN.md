# Matchreport — Hintergrund-Alarm Analyse & Lösungsplan

## Das Problem

Die App muss als Spielleiter-Werkzeug **garantiert** den Halbzeit-/Schlusspfiff auslösen — egal ob das Handy gesperrt ist, YouTube läuft, ein Telefonat geführt wird, oder die App im Hintergrund ist. Aktuell feuert der Alarm nicht zuverlässig.

---

## Ursachenanalyse (5 Ebenen)

### Ebene 1: Android Doze Mode
- Ab Android 6.0 geht das Handy in den "Doze"-Modus wenn es still liegt und der Bildschirm aus ist
- **Alle normalen Alarme werden verschoben** bis ein "Wartungsfenster" öffnet (kann Minuten dauern)
- `setExactAndAllowWhileIdle()` hilft, hat aber eine **9-Minuten-Drosselung** (max 1 Alarm pro 9 Min)

### Ebene 2: Hersteller-Batterieoptimierung
- **Samsung**: "Sleeping Apps" Liste — Apps die 3 Tage nicht genutzt werden, werden gekillt. Batterieoptimierung wird nach System-Updates zurückgesetzt.
- **Xiaomi/MIUI**: Killt Background-Services aggressiv, Autostart-Berechtigungen werden nach Updates zurückgesetzt
- **Huawei/Honor**: PowerGenie überwacht WakeLock-Nutzung, killt Apps die zu oft aufwachen
- **OPPO/ColorOS**: "Sleep Standby Optimization" friert Apps ein

### Ebene 3: App Standby Buckets (Android 9+)
- Android kategorisiert Apps nach Nutzungshäufigkeit
- "Restricted" Bucket: Alarme werden auf 1x pro Tag begrenzt
- Unsere App wird möglicherweise in niedrige Buckets eingestuft

### Ebene 4: WebView JavaScript Suspension
- Capacitor-Apps laufen in einem WebView
- Bei Bildschirmsperre wird JavaScript **komplett pausiert**
- Timer, Callbacks, Promises — alles stoppt
- Erst beim Entsperren wird JS fortgesetzt

### Ebene 5: Unser aktueller Code
- `AlarmManager.setExactAndAllowWhileIdle()` — nicht die höchste Priorität
- AlarmReceiver hat keinen WakeLock — Android kann den Ton kürzen
- ForegroundService hat keinen eigenen Timer-Thread
- Keine Aufforderung an den User, Batterieoptimierung zu deaktivieren

---

## Lösungsplan (4 Maßnahmen)

### Maßnahme 1: `setAlarmClock()` statt `setExactAndAllowWhileIdle()`
**Priorität: KRITISCH**

`setAlarmClock()` ist die **höchste Alarmstufe** in Android:
- Behandelt wie ein Wecker den der User gestellt hat
- Android **verlässt Doze-Mode automatisch** kurz bevor der Alarm feuert
- Keine 9-Minuten-Drosselung
- Zeigt ein Wecker-Symbol in der Statusbar (Vertrauenssignal für den User)
- Funktioniert auf ALLEN Herstellern zuverlässig

```java
AlarmManager.AlarmClockInfo info = new AlarmManager.AlarmClockInfo(triggerAtMs, showIntent);
alarmManager.setAlarmClock(info, pendingIntent);
```

### Maßnahme 2: AlarmReceiver mit WakeLock
**Priorität: KRITISCH**

Der BroadcastReceiver muss einen WakeLock halten damit Android die CPU nicht sofort wieder schlafen legt während der Ton spielt:

```java
public void onReceive(Context context, Intent intent) {
    PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
    PowerManager.WakeLock wl = pm.newWakeLock(
        PowerManager.PARTIAL_WAKE_LOCK, "matchreport:alarm");
    wl.acquire(120 * 1000L); // Max 120 Sekunden
    
    // Ton spielen...
    // Vibration...
    
    // WakeLock release nach Ton-Ende
}
```

### Maßnahme 3: ForegroundService mit eigenem Timer-Thread
**Priorität: HOCH**

Der ForegroundService soll NICHT vom WebView abhängen. Er bekommt einen eigenen Java-Timer der den Halbzeitende-Zeitpunkt überwacht und den Alarm auslöst — als Backup falls der AlarmManager versagt.

```java
// Im ForegroundService:
private Handler handler = new Handler(Looper.getMainLooper());
private long alarmTime = 0;

// Alle 5 Sekunden prüfen
handler.postDelayed(new Runnable() {
    public void run() {
        if (alarmTime > 0 && System.currentTimeMillis() >= alarmTime) {
            fireAlarm(); // Ton + Vibration
            alarmTime = 0;
        }
        handler.postDelayed(this, 5000);
    }
}, 5000);
```

### Maßnahme 4: Battery Optimization Exempt + User Guidance
**Priorität: HOCH**

Die App muss den User beim ersten Spielstart auffordern, die Batterieoptimierung zu deaktivieren:

```java
// Permission im Manifest:
<uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" />

// Im Plugin:
Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
intent.setData(Uri.parse("package:" + context.getPackageName()));
context.startActivity(intent);
```

**Plus: In-App Hinweis** für Samsung/Xiaomi-User mit herstellerspezifischen Anleitungen (Link zu dontkillmyapp.com).

---

## Implementierungsreihenfolge

| # | Maßnahme | Aufwand | Wirkung |
|---|----------|---------|---------|
| 1 | `setAlarmClock()` | 30 min | ★★★★★ |
| 2 | WakeLock im AlarmReceiver | 15 min | ★★★★☆ |
| 3 | Timer-Thread im ForegroundService | 45 min | ★★★★☆ |
| 4 | Battery Optimization Exempt | 30 min | ★★★☆☆ |

**Gesamt: ~2 Stunden Entwicklung**

---

## Erwartetes Ergebnis

Nach Umsetzung aller 4 Maßnahmen hat die App **3 unabhängige Mechanismen** die den Alarm auslösen:

1. **AlarmManager.setAlarmClock()** — höchste Android-Priorität, weckt aus Doze
2. **ForegroundService Timer-Thread** — eigener Java-Thread, unabhängig von WebView
3. **WebView JavaScript Timer** — Timestamp-basiert, feuert wenn App im Vordergrund

Wenn einer versagt, fangen die anderen auf. Das ist die gleiche Architektur die professionelle Wecker-Apps und medizinische Überwachungs-Apps nutzen.

---

## Quellen
- developer.android.com/develop/background-work/services/alarms
- dontkillmyapp.com (Samsung, Xiaomi, Huawei Workarounds)
- dev.to/stoyan_minchev — "11 layers to survive OEM background killing"
