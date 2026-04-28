package com.matchreport.app.ringtones;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.os.Handler;
import android.os.Looper;
import android.os.Vibrator;

public class AlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        // Play loud alarm sound on STREAM_ALARM (bypasses silent mode)
        try {
            ToneGenerator tg = new ToneGenerator(AudioManager.STREAM_ALARM, 100);
            // Three short beeps, then pause, then three more
            tg.startTone(ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD, 500);
            new Handler(Looper.getMainLooper()).postDelayed(() -> {
                tg.startTone(ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD, 500);
            }, 700);
            new Handler(Looper.getMainLooper()).postDelayed(() -> {
                tg.startTone(ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD, 800);
                new Handler(Looper.getMainLooper()).postDelayed(tg::release, 1000);
            }, 1400);
        } catch (Exception e) { }

        // Vibrate
        try {
            Vibrator v = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
            if (v != null) v.vibrate(new long[]{0, 300, 200, 300, 200, 500}, -1);
        } catch (Exception e) { }
    }
}
